// Performance optimization configuration for UpTrends app

export const PERFORMANCE_CONFIG = {
    // API Configuration
    API: {
        // Request timeouts
        TIMEOUT_FAST: 5000,      // 5 seconds for fast requests
        TIMEOUT_NORMAL: 15000,   // 15 seconds for normal requests
        TIMEOUT_SLOW: 30000,     // 30 seconds for complex requests

        // Retry configuration
        MAX_RETRIES: 3,
        RETRY_DELAY_BASE: 1000,  // Base delay in ms
        RETRY_DELAY_MAX: 5000,   // Max delay in ms

        // Rate limiting
        RATE_LIMIT_WINDOW: 60000, // 1 minute window
        RATE_LIMIT_MAX_REQUESTS: 30, // Max requests per window

        // Caching
        CACHE_TTL_SHORT: 5 * 60 * 1000,    // 5 minutes
        CACHE_TTL_MEDIUM: 30 * 60 * 1000,  // 30 minutes
        CACHE_TTL_LONG: 2 * 60 * 60 * 1000, // 2 hours
        MAX_CACHE_SIZE: 100,

        // Request batching
        BATCH_SIZE: 3,
        BATCH_DELAY: 100, // ms
    },

    // Gemini AI Configuration
    GEMINI: {
        // Model selection based on request type
        MODELS: {
            FAST: 'gemini-3.1-flash-lite',
            BALANCED: 'gemini-3.5-flash',
            QUALITY: 'gemini-3.5-flash',
        },

        // Generation config for different use cases
        GENERATION_CONFIG: {
            FAST: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            },
            BALANCED: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            },
            QUALITY: {
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            },
        },

        // Request prioritization
        PRIORITY: {
            HIGH: 3,    // Body analysis, critical user actions
            MEDIUM: 2,  // Outfit generation, style analysis
            LOW: 1,     // Background tasks, caching
        },

        // Prompt optimization
        PROMPT_OPTIMIZATION: {
            MAX_PROMPT_LENGTH: 2000,
            ENABLE_COMPRESSION: true,
            USE_STRUCTURED_OUTPUT: true,
        },
    },

    // Image Processing
    IMAGE: {
        // Compression settings
        QUALITY_HIGH: 0.9,
        QUALITY_MEDIUM: 0.8,
        QUALITY_LOW: 0.6,

        // Size limits
        MAX_SIZE_MB: 5,
        MAX_DIMENSION: 2048,

        // Format preferences
        PREFERRED_FORMAT: 'jpeg',
        FALLBACK_FORMAT: 'png',

        // Processing timeouts
        PROCESSING_TIMEOUT: 10000,
    },

    // UI Performance
    UI: {
        // Animation settings
        ANIMATION_DURATION_FAST: 200,
        ANIMATION_DURATION_NORMAL: 300,
        ANIMATION_DURATION_SLOW: 500,

        // List optimization
        INITIAL_NUM_TO_RENDER: 10,
        MAX_TO_RENDER_PER_BATCH: 5,
        WINDOW_SIZE: 21,

        // Image loading
        LAZY_LOADING_THRESHOLD: 100,
        PLACEHOLDER_FADE_DURATION: 300,

        // Debounce settings
        SEARCH_DEBOUNCE: 300,
        INPUT_DEBOUNCE: 150,
    },

    // Memory Management
    MEMORY: {
        // Cache limits
        IMAGE_CACHE_SIZE: 50,
        RESPONSE_CACHE_SIZE: 100,

        // Cleanup intervals
        CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
        MEMORY_WARNING_THRESHOLD: 0.8, // 80% of available memory

        // Garbage collection hints
        GC_INTERVAL: 30 * 1000, // 30 seconds
    },

    // Network Optimization
    NETWORK: {
        // Connection settings
        CONCURRENT_REQUESTS: 6,
        KEEP_ALIVE_TIMEOUT: 30000,

        // Offline handling
        OFFLINE_RETRY_INTERVAL: 5000,
        MAX_OFFLINE_RETRIES: 5,

        // Preloading
        PRELOAD_CRITICAL_RESOURCES: true,
        PRELOAD_NEXT_SCREEN: false,
    },

    // Analytics & Monitoring
    MONITORING: {
        // Performance tracking
        TRACK_RENDER_TIME: true,
        TRACK_API_LATENCY: true,
        TRACK_MEMORY_USAGE: false, // Disable in production

        // Error reporting
        MAX_ERROR_REPORTS_PER_SESSION: 10,
        ERROR_SAMPLING_RATE: 0.1, // 10% of errors

        // User experience metrics
        TRACK_USER_INTERACTIONS: true,
        TRACK_SCREEN_TRANSITIONS: true,
    },
};

// Performance utility functions
export const PerformanceUtils = {
    // Debounce function for user inputs
    debounce: <T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): ((...args: Parameters<T>) => void) => {
        let timeout: NodeJS.Timeout;
        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    },

    // Throttle function for scroll events
    throttle: <T extends (...args: any[]) => any>(
        func: T,
        limit: number
    ): ((...args: Parameters<T>) => void) => {
        let inThrottle: boolean;
        return (...args: Parameters<T>) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    // Memory usage checker
    checkMemoryUsage: (): number => {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const memory = (performance as any).memory;
            return memory.usedJSHeapSize / memory.totalJSHeapSize;
        }
        return 0;
    },

    // Image optimization helper
    optimizeImageUri: (uri: string, quality: number = PERFORMANCE_CONFIG.IMAGE.QUALITY_MEDIUM): string => {
        // Add quality parameter to image URI if supported
        if (uri.includes('?')) {
            return `${uri}&quality=${Math.round(quality * 100)}`;
        }
        return `${uri}?quality=${Math.round(quality * 100)}`;
    },

    // Request priority helper
    getRequestPriority: (requestType: string): number => {
        switch (requestType) {
            case 'body-analysis':
            case 'user-action':
                return PERFORMANCE_CONFIG.GEMINI.PRIORITY.HIGH;
            case 'outfit-generation':
            case 'style-analysis':
                return PERFORMANCE_CONFIG.GEMINI.PRIORITY.MEDIUM;
            default:
                return PERFORMANCE_CONFIG.GEMINI.PRIORITY.LOW;
        }
    },
};

export default PERFORMANCE_CONFIG;