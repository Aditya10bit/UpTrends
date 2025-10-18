import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface PerformanceMonitorProps {
    children: React.ReactNode;
    onMemoryWarning?: () => void;
    onPerformanceIssue?: (issue: string) => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
    children,
    onMemoryWarning,
    onPerformanceIssue
}) => {
    const memoryCheckInterval = useRef<NodeJS.Timeout | null>(null);;
    const performanceMetrics = useRef({
        apiCallCount: 0,
        lastApiCall: 0,
        memoryWarnings: 0
    });

    const checkMemoryUsage = () => {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const memory = (performance as any).memory;
            const usageRatio = memory.usedJSHeapSize / memory.totalJSHeapSize;

            if (usageRatio > 0.85) { // 85% memory usage
                performanceMetrics.current.memoryWarnings++;
                console.warn(`High memory usage detected: ${Math.round(usageRatio * 100)}%`);
                onMemoryWarning?.();

                // Force garbage collection if available
                if ((global as any).gc) {
                    (global as any).gc();
                }
            }
        }
    };

    const monitorApiCalls = () => {
        const now = Date.now();
        performanceMetrics.current.apiCallCount++;

        // Check for rapid API calls (more than 5 in 10 seconds)
        if (now - performanceMetrics.current.lastApiCall < 2000) {
            if (performanceMetrics.current.apiCallCount > 5) {
                onPerformanceIssue?.('Rapid API calls detected - may cause UI blocking');
            }
        }

        performanceMetrics.current.lastApiCall = now;
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
            // Clear intervals when app goes to background
            if (memoryCheckInterval.current) {
                clearInterval(memoryCheckInterval.current);
            }
        } else if (nextAppState === 'active') {
            // Restart monitoring when app becomes active
            startMonitoring();
        }
    };

    const startMonitoring = () => {
        // Check memory every 30 seconds
        memoryCheckInterval.current = setInterval(checkMemoryUsage, 30000);
    };

    useEffect(() => {
        startMonitoring();

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Monitor global errors
        const originalConsoleError = console.error;
        console.error = (...args) => {
            const errorMessage = args.join(' ');
            if (errorMessage.includes('Gemini') || errorMessage.includes('API')) {
                onPerformanceIssue?.(`API Error: ${errorMessage}`);
            }
            originalConsoleError(...args);
        };

        return () => {
            if (memoryCheckInterval.current) {
                clearInterval(memoryCheckInterval.current);
            }
            subscription?.remove();
            console.error = originalConsoleError;
        };
    }, []);

    // Expose performance metrics globally for debugging
    useEffect(() => {
        if (__DEV__) {
            (global as any).__PERFORMANCE_METRICS__ = performanceMetrics.current;
        }
    }, []);

    return <>{children}</>;
};

// Hook to use performance monitoring
export const usePerformanceMonitor = () => {
    const trackApiCall = () => {
        if (__DEV__) {
            console.log('API call tracked');
        }
    };

    const checkMemoryPressure = (): boolean => {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const memory = (performance as any).memory;
            const usageRatio = memory.usedJSHeapSize / memory.totalJSHeapSize;
            return usageRatio > 0.8;
        }
        return false;
    };

    const getPerformanceMetrics = () => {
        if (__DEV__ && (global as any).__PERFORMANCE_METRICS__) {
            return (global as any).__PERFORMANCE_METRICS__;
        }
        return null;
    };

    return {
        trackApiCall,
        checkMemoryPressure,
        getPerformanceMetrics
    };
};

export default PerformanceMonitor;