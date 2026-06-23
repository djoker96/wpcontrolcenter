<?php
if (!defined('ABSPATH')) {
    exit;
}

function wpcc_agent_get_option($key, $default = null) {
    return get_option('wpcc_agent_' . $key, $default);
}

function wpcc_agent_update_option($key, $value) {
    // Disable autoload for secrets: load only when explicitly requested.
    $autoload = $key === 'secret_key' ? false : null;
    return update_option('wpcc_agent_' . $key, $value, $autoload);
}

/**
 * Retrieve the HMAC secret key used for agent↔control-plane authentication.
 *
 * Precedence:
 *   1. `WPCC_SECRET_KEY` constant (defined in wp-config.php) — strongly
 *      preferred; keeps the key outside the database.
 *   2. `wpcc_agent_secret_key` option (wp_options table, legacy).
 *
 * Always store the key in wp-config.php for production; the DB path is
 * retained for backward compatibility with existing installations.
 */
function wpcc_agent_get_secret_key(): string {
    if (defined('WPCC_SECRET_KEY') && WPCC_SECRET_KEY !== '') {
        return WPCC_SECRET_KEY;
    }
    $value = get_option('wpcc_agent_secret_key', '');
    return is_string($value) ? $value : '';
}

/**
 * Verify a file begins with the ZIP local-file-header magic bytes (PK\x03\x04).
 * Defends against installing/restoring non-zip or polyglot payloads.
 */
function wpcc_agent_is_zip_file($filepath): bool {
    if (!is_file($filepath) || !is_readable($filepath)) {
        return false;
    }
    $handle = fopen($filepath, 'rb');
    if (!$handle) {
        return false;
    }
    $magic = fread($handle, 4);
    fclose($handle);
    // PK\x03\x04 (normal), PK\x05\x06 (empty archive) are both valid ZIP signatures.
    return $magic === "PK\x03\x04" || $magic === "PK\x05\x06";
}

/**
 * Extract a ZIP archive while blocking Zip-Slip (path traversal) entries.
 * Rejects absolute paths, parent-directory traversal, and any entry whose
 * resolved destination escapes $dest. Returns true on success.
 *
 * @throws Exception on a malicious entry.
 */
function wpcc_agent_safe_extract_zip(string $zip_path, string $dest): bool {
    $zip = new ZipArchive();
    if ($zip->open($zip_path) !== true) {
        throw new Exception('Failed to open ZIP archive.');
    }

    $dest = rtrim($dest, '/\\');
    $dest_real = realpath($dest);
    if ($dest_real === false) {
        $zip->close();
        throw new Exception('Extraction destination does not exist.');
    }
    $dest_prefix = $dest_real . DIRECTORY_SEPARATOR;

    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entry = $zip->getNameIndex($i);
        if ($entry === false) {
            continue;
        }

        // Reject absolute paths, drive letters, and any parent traversal.
        if ($entry === '' || $entry[0] === '/' || $entry[0] === '\\'
            || preg_match('#^[a-zA-Z]:#', $entry)
            || strpos($entry, '..') !== false
            || strpos($entry, "\0") !== false) {
            $zip->close();
            throw new Exception('Unsafe ZIP entry rejected: ' . $entry);
        }

        // Verify the normalized target stays inside the destination.
        $target = $dest_prefix . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $entry);
        $normalized = wpcc_agent_normalize_path($target);
        if (strpos($normalized, $dest_prefix) !== 0) {
            $zip->close();
            throw new Exception('ZIP entry escapes destination: ' . $entry);
        }
    }

    $ok = $zip->extractTo($dest);
    $zip->close();
    if (!$ok) {
        throw new Exception('Failed to extract ZIP archive.');
    }
    return true;
}

/**
 * Split a SQL dump into individual statements, respecting single-quoted string
 * literals (with '' and \' escapes) and backtick identifiers, so a `;` or
 * newline *inside* a value never splits a statement mid-literal. Replaces the
 * fragile explode(";\n") which could break/inject on crafted data.
 *
 * @return string[] trimmed non-empty statements.
 */
function wpcc_agent_split_sql(string $sql): array {
    $statements = [];
    $buf = '';
    $len = strlen($sql);
    $inSingle = false;   // inside '...'
    $inBacktick = false; // inside `...`

    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];

        if ($inSingle) {
            $buf .= $ch;
            if ($ch === '\\' && $i + 1 < $len) { // escaped char (e.g. \')
                $buf .= $sql[++$i];
            } elseif ($ch === "'") {
                if ($i + 1 < $len && $sql[$i + 1] === "'") { // '' escape
                    $buf .= $sql[++$i];
                } else {
                    $inSingle = false;
                }
            }
            continue;
        }

        if ($inBacktick) {
            $buf .= $ch;
            if ($ch === '`') $inBacktick = false;
            continue;
        }

        if ($ch === "'") { $inSingle = true; $buf .= $ch; continue; }
        if ($ch === '`') { $inBacktick = true; $buf .= $ch; continue; }

        if ($ch === ';') {
            $stmt = trim($buf);
            if ($stmt !== '') $statements[] = $stmt;
            $buf = '';
            continue;
        }

        $buf .= $ch;
    }

    $stmt = trim($buf);
    if ($stmt !== '') $statements[] = $stmt;
    return $statements;
}

/**
 * Lexically normalize a path (resolve ./ and ../) without touching the filesystem.
 */
function wpcc_agent_normalize_path(string $path): string {
    $is_abs = ($path !== '' && ($path[0] === '/' || $path[0] === '\\'));
    $parts = preg_split('#[/\\\\]+#', $path);
    $stack = [];
    foreach ($parts as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            array_pop($stack);
        } else {
            $stack[] = $part;
        }
    }
    return ($is_abs ? DIRECTORY_SEPARATOR : '') . implode(DIRECTORY_SEPARATOR, $stack);
}
