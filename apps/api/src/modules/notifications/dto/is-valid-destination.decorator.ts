import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Custom decorator that validates `destination` based on `channelType`.
 *
 * - WEBHOOK / SLACK / DISCORD: must be an https URL
 * - TELEGRAM: must match botToken:chatId pattern
 */
export function IsValidDestination(validationOptions?: ValidationOptions) {
  return function (object: unknown, propertyName: string) {
    registerDecorator({
      name: 'isValidDestination',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: {
        message:
          'destination must be an https URL for WEBHOOK/SLACK/DISCORD or token:chatId for TELEGRAM',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string' || !value) return false;

          // Access the sibling property `channelType` via the DTO object.
          const dto = args.object as Record<string, unknown>;
          const channelType = String(dto.channelType ?? '');

          switch (channelType) {
            case 'WEBHOOK':
            case 'SLACK':
            case 'DISCORD':
              try {
                const url = new URL(value);
                return url.protocol === 'https:';
              } catch {
                return false;
              }
            case 'TELEGRAM':
              return /^\d{6,}:-?\d+$/.test(value);
            default:
              return false;
          }
        },
      },
    });
  };
}
