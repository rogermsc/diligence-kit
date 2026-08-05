import { z } from 'zod';
import { PayloadValidator } from './payload-validator';

// Example: User registration schema
const userRegistrationSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    age: z.number().min(18, 'Must be at least 18 years old')
});

// Example: API endpoint validation
const updateCompanySchema = z.object({
    id: z.string().uuid('Company ID must be a valid UUID'),
    name: z.string().min(1, 'Company name is required'),
    status: z.enum(['ACTIVE', 'INACTIVE'])
});

// Example usage in a service or controller:
export class ExampleUsage {

    // Method 1: Basic validation with context
    validateUserRegistration(data: unknown) {
        try {
            const validatedUser = PayloadValidator.validate(
                data,
                userRegistrationSchema,
                'UserRegistration'
            );

            console.log('User registration data is valid:', validatedUser);
            return validatedUser;
        } catch (error) {
            // ValidationError will be thrown with detailed error info
            console.error('User registration validation failed:', error);
            throw error;
        }
    }

    // Method 2: Safe validation (no throwing)
    validateCompanyUpdate(data: unknown) {
        const result = PayloadValidator.validateSafe(
            data,
            updateCompanySchema,
            'CompanyUpdate'
        );

        if (result.success) {
            console.log('Company update data is valid:', result.data);
            return result.data;
        } else {
            console.error('Company update validation failed:', result.error);
            // Handle error without throwing
            return null;
        }
    }

    // Method 3: Quick validation with custom message
    validateQuick(data: unknown) {
        try {
            return PayloadValidator.validateOrThrow(
                data,
                userRegistrationSchema,
                'User data validation failed'
            );
        } catch (error) {
            console.error('Quick validation failed:', error);
            throw error;
        }
    }
}

/*
Usage examples:

// In a controller:
@Post('/register')
async registerUser(@Body() body: unknown) {
    const userData = PayloadValidator.validate(body, userRegistrationSchema, 'UserRegistration');
    return await this.userService.createUser(userData);
}

// In a service:
async processData(rawData: unknown) {
    const result = PayloadValidator.validateSafe(rawData, mySchema, 'DataProcessing');
    if (!result.success) {
        this.logger.error('Data validation failed', result.error);
        return { success: false, error: result.error };
    }
    
    return await this.doSomethingWith(result.data);
}

// In an event handler:
@EventPattern('user.created')
async handleUserCreated(payload: unknown) {
    const validatedPayload = PayloadValidator.validate(payload, userEventSchema, 'UserCreatedEvent');
    await this.processUserCreated(validatedPayload);
}
*/
