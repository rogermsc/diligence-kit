import { applyDecorators } from '@nestjs/common';
import { 
    ApiOperation, 
    ApiBody, 
    ApiResponse 
} from '@nestjs/swagger';

export const ApiLogin = () => {
    return applyDecorators(
        ApiOperation({ summary: 'User login' }),
        ApiBody({
            description: 'User credentials',
            schema: {
                type: 'object',
                properties: {
                    email: { type: 'string', example: 'user@example.com' },
                    password: { type: 'string', example: 'strongpassword123' }
                },
                required: ['email', 'password']
            }
        }),
        ApiResponse({ 
            status: 200, 
            description: 'Login successful',
            schema: {
                type: 'object',
                properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' }
                }
            }
        }),
        ApiResponse({ status: 401, description: 'Invalid credentials' })
    );
};

export const ApiRefreshToken = () => {
    return applyDecorators(
        ApiOperation({ summary: 'Refresh token' }),
        ApiBody({
            description: 'Refresh token to renew',
            schema: {
                type: 'object',
                properties: {
                    refreshToken: { type: 'string' }
                },
                required: ['refreshToken']
            }
        }),
        ApiResponse({ 
            status: 200, 
            description: 'Token renewed successfully',
            schema: {
                type: 'object',
                properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' }
                }
            }
        }),
        ApiResponse({ status: 401, description: 'Invalid refresh token' })
    );
};
