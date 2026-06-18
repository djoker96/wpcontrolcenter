"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitesController = void 0;
const common_1 = require("@nestjs/common");
let SitesController = (() => {
    let _classDecorators = [(0, common_1.Controller)('sites')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _findAll_decorators;
    let _create_decorators;
    let _findOne_decorators;
    let _update_decorators;
    let _remove_decorators;
    let _generateConnectionToken_decorators;
    let _rotateSecret_decorators;
    let _resync_decorators;
    let _overview_decorators;
    let _plugins_decorators;
    let _themes_decorators;
    let _core_decorators;
    let _uptime_decorators;
    let _incidents_decorators;
    let _analytics_decorators;
    let _auditLogs_decorators;
    let _executeAction_decorators;
    let _attachIntegration_decorators;
    var SitesController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _findAll_decorators = [(0, common_1.Get)()];
            _create_decorators = [(0, common_1.Post)()];
            _findOne_decorators = [(0, common_1.Get)(':id')];
            _update_decorators = [(0, common_1.Patch)(':id')];
            _remove_decorators = [(0, common_1.Delete)(':id')];
            _generateConnectionToken_decorators = [(0, common_1.Post)(':id/generate-connection-token')];
            _rotateSecret_decorators = [(0, common_1.Post)(':id/rotate-secret')];
            _resync_decorators = [(0, common_1.Post)(':id/resync')];
            _overview_decorators = [(0, common_1.Get)(':id/overview')];
            _plugins_decorators = [(0, common_1.Get)(':id/plugins')];
            _themes_decorators = [(0, common_1.Get)(':id/themes')];
            _core_decorators = [(0, common_1.Get)(':id/core')];
            _uptime_decorators = [(0, common_1.Get)(':id/uptime')];
            _incidents_decorators = [(0, common_1.Get)(':id/incidents')];
            _analytics_decorators = [(0, common_1.Get)(':id/analytics')];
            _auditLogs_decorators = [(0, common_1.Get)(':id/audit-logs')];
            _executeAction_decorators = [(0, common_1.Post)(':id/actions/:action')];
            _attachIntegration_decorators = [(0, common_1.Post)(':id/integrations/:provider')];
            __esDecorate(this, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: obj => "findAll" in obj, get: obj => obj.findAll }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: obj => "create" in obj, get: obj => obj.create }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: obj => "findOne" in obj, get: obj => obj.findOne }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: obj => "update" in obj, get: obj => obj.update }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: obj => "remove" in obj, get: obj => obj.remove }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateConnectionToken_decorators, { kind: "method", name: "generateConnectionToken", static: false, private: false, access: { has: obj => "generateConnectionToken" in obj, get: obj => obj.generateConnectionToken }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _rotateSecret_decorators, { kind: "method", name: "rotateSecret", static: false, private: false, access: { has: obj => "rotateSecret" in obj, get: obj => obj.rotateSecret }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resync_decorators, { kind: "method", name: "resync", static: false, private: false, access: { has: obj => "resync" in obj, get: obj => obj.resync }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _overview_decorators, { kind: "method", name: "overview", static: false, private: false, access: { has: obj => "overview" in obj, get: obj => obj.overview }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _plugins_decorators, { kind: "method", name: "plugins", static: false, private: false, access: { has: obj => "plugins" in obj, get: obj => obj.plugins }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _themes_decorators, { kind: "method", name: "themes", static: false, private: false, access: { has: obj => "themes" in obj, get: obj => obj.themes }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _core_decorators, { kind: "method", name: "core", static: false, private: false, access: { has: obj => "core" in obj, get: obj => obj.core }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _uptime_decorators, { kind: "method", name: "uptime", static: false, private: false, access: { has: obj => "uptime" in obj, get: obj => obj.uptime }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _incidents_decorators, { kind: "method", name: "incidents", static: false, private: false, access: { has: obj => "incidents" in obj, get: obj => obj.incidents }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _analytics_decorators, { kind: "method", name: "analytics", static: false, private: false, access: { has: obj => "analytics" in obj, get: obj => obj.analytics }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _auditLogs_decorators, { kind: "method", name: "auditLogs", static: false, private: false, access: { has: obj => "auditLogs" in obj, get: obj => obj.auditLogs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _executeAction_decorators, { kind: "method", name: "executeAction", static: false, private: false, access: { has: obj => "executeAction" in obj, get: obj => obj.executeAction }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _attachIntegration_decorators, { kind: "method", name: "attachIntegration", static: false, private: false, access: { has: obj => "attachIntegration" in obj, get: obj => obj.attachIntegration }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            SitesController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        sitesService = __runInitializers(this, _instanceExtraInitializers);
        constructor(sitesService) {
            this.sitesService = sitesService;
        }
        findAll(query) { return { data: this.sitesService.findAll(), query }; }
        create(body) { return { id: 'site_new', ...body }; }
        findOne(id) { return this.sitesService.findOne(id); }
        update(id, body) { return { id, ...body }; }
        remove(id) { return { success: true, id }; }
        generateConnectionToken(id) { return { siteId: id, token: 'one-time-token' }; }
        rotateSecret(id) { return { siteId: id, rotated: true }; }
        resync(id) { return { siteId: id, jobId: 'job_resync_stub' }; }
        overview(id) { return { siteId: id, summary: { pendingUpdates: 3, isUp: true } }; }
        plugins(id) { return { siteId: id, data: [] }; }
        themes(id) { return { siteId: id, data: [] }; }
        core(id) { return { siteId: id, versionInstalled: '6.5.5' }; }
        uptime(id) { return { siteId: id, data: [] }; }
        incidents(id) { return { siteId: id, data: [] }; }
        analytics(id) { return { siteId: id, summary: {} }; }
        auditLogs(id) { return { siteId: id, data: [] }; }
        executeAction(id, action, body) {
            return { siteId: id, action, jobId: `job_${action}`, payload: body };
        }
        attachIntegration(id, provider, body) {
            return { siteId: id, provider, ...body };
        }
    };
    return SitesController = _classThis;
})();
exports.SitesController = SitesController;
