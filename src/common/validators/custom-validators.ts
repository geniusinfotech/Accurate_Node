/* eslint-disable prettier/prettier */
import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import { Types } from 'mongoose';

/**
 * Validate strong password
 */
@ValidatorConstraint({ async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
    validate(password: string, args: ValidationArguments) {
        if (typeof password !== 'string') return false;

        // Minimum 12 characters
        if (password.length < 12) return false;

        // At least one uppercase letter
        if (!/[A-Z]/.test(password)) return false;

        // At least one lowercase letter
        if (!/[a-z]/.test(password)) return false;

        // At least one number
        if (!/\d/.test(password)) return false;

        // At least one special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;

        // Common passwords check (basic list)
        const commonPasswords = ['password123', 'admin123', 'qwerty123', '123456789', 'password1'];
        if (commonPasswords.includes(password.toLowerCase())) return false;

        return true;
    }

    defaultMessage(args: ValidationArguments) {
        return 'Password must be at least 12 characters long and contain uppercase, lowercase, number, and special character';
    }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsStrongPasswordConstraint,
        });
    };
}

/**
 * Validate MongoDB ObjectId
 */
@ValidatorConstraint({ async: false })
export class IsValidObjectIdConstraint implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        return Types.ObjectId.isValid(value);
    }

    defaultMessage(args: ValidationArguments) {
        return 'Invalid ObjectId format';
    }
}

export function IsValidObjectId(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsValidObjectIdConstraint,
        });
    };
}

/**
 * Validate sanitized string (no HTML/script tags)
 */
@ValidatorConstraint({ async: false })
export class IsSanitizedStringConstraint implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        if (typeof value !== 'string') return false;

        // Check for HTML tags
        if (/<[^>]*>/g.test(value)) return false;

        // Check for script content
        if (/(<script|javascript:|onerror=|onclick=)/gi.test(value)) return false;

        return true;
    }

    defaultMessage(args: ValidationArguments) {
        return ' HTML tags and scripts are not allowed';
    }
}

export function IsSanitizedString(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsSanitizedStringConstraint,
        });
    };
}

/**
 * Validate safe filename
 */
@ValidatorConstraint({ async: false })
export class IsSafeFilenameConstraint implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments) {
        if (typeof value !== 'string') return false;

        // Check for directory traversal
        if (/\.\./.test(value)) return false;
        if (/[\/\\]/.test(value)) return false;

        // Check for special characters
        if (/[<>:"|?*\x00-\x1F]/.test(value)) return false;

        return true;
    }

    defaultMessage(args: ValidationArguments) {
        return 'Filename contains invalid characters';
    }
}

export function IsSafeFilename(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsSafeFilenameConstraint,
        });
    };
}
