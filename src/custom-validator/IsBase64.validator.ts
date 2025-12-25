import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsBase64(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isBase64',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }
          // Accept data URLs and extract the base64 part
          const dataUrlMatch = value.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.*)$/);
          let base64String = value;
          if (dataUrlMatch) {
            base64String = dataUrlMatch[2];
          }
          const base64Regex =
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
          return base64Regex.test(base64String);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Base64 string or data URL`;
        },
      },
    });
  };
}
