# Exchange Package

## Exchange Implementation Patterns

When implementing an exchange integration, follow these patterns:

### HTTP Client

- Use `axios` with `axios-retry` for reliable network communication
- Handle network errors (e.g., `EAI_AGAIN`) and rate limits (e.g., HTTP 429)
- Configure retry delays based on exchange-specific rate limit documentation

### Environments

- Support both paper trading (sandbox) and live trading environments
- Use environment-specific API endpoints and credentials

### Validation

- Use `zod` schemas for all API responses
- Define schemas with proper datetime parsing
- Validate both request and response data

### Structure

- Separate API classes by domain (e.g., Account, Orders, Market Data, Portfolio)
- Use consistent method naming across different exchange implementations
- Implement a common interface for cross-exchange compatibility
