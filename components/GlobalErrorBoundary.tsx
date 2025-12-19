/**
 * Global Error Boundary for React Native
 * 
 * Purpose: Catch and handle unhandled errors gracefully
 * Prevents the app from crashing and shows user-friendly error screen
 * 
 * For long-term stability: This ensures the app never crashes
 * completely and users can always recover.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorCount: number;
}

// Track error count across sessions for detecting recurring issues
const ERROR_COUNT_KEY = 'app_error_count';
const ERROR_RESET_THRESHOLD = 5; // Reset after 5 errors
const ERROR_TIMESTAMP_KEY = 'last_error_timestamp';

class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log the error
        logger.error('Uncaught error in React component tree', error, {
            componentStack: errorInfo.componentStack,
        });

        // Track error count for detecting recurring issues
        try {
            const countStr = await AsyncStorage.getItem(ERROR_COUNT_KEY);
            const count = parseInt(countStr || '0', 10) + 1;
            await AsyncStorage.setItem(ERROR_COUNT_KEY, count.toString());
            await AsyncStorage.setItem(ERROR_TIMESTAMP_KEY, new Date().toISOString());

            this.setState({ errorInfo, errorCount: count });

            // If too many errors in a short time, clear app state
            if (count >= ERROR_RESET_THRESHOLD) {
                logger.warn('Too many errors detected, will clear app state on next restart');
            }
        } catch (e) {
            // Ignore storage errors
        }

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReload = () => {
        // Clear error state and try again
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleClearAndReload = async () => {
        try {
            // Clear error count
            await AsyncStorage.removeItem(ERROR_COUNT_KEY);

            // Clear potentially corrupted app state
            const keysToKeep = ['@user_settings', '@theme_preference'];
            const allKeys = await AsyncStorage.getAllKeys();
            const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
            await AsyncStorage.multiRemove(keysToRemove);

            logger.info('Cleared app state due to repeated errors');
        } catch (e) {
            // Ignore storage errors
        }

        // Reload
        this.handleReload();
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <AlertTriangle size={64} color="#EF4444" />
                        <Text style={styles.title}>Oops! Something went wrong</Text>
                        <Text style={styles.message}>
                            We encountered an unexpected error. This has been logged and we'll look into it.
                        </Text>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorDetails}>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo?.componentStack && (
                                    <Text style={styles.stackText}>
                                        {this.state.errorInfo.componentStack}
                                    </Text>
                                )}
                            </ScrollView>
                        )}

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={this.handleReload}
                                activeOpacity={0.8}
                            >
                                <RefreshCw size={20} color="#FFF" />
                                <Text style={styles.primaryButtonText}>Try Again</Text>
                            </TouchableOpacity>

                            {this.state.errorCount >= 2 && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={this.handleClearAndReload}
                                    activeOpacity={0.8}
                                >
                                    <Home size={20} color="#6B7280" />
                                    <Text style={styles.secondaryButtonText}>Clear Data & Restart</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {this.state.errorCount > 1 && (
                            <Text style={styles.recurringText}>
                                This error has occurred {this.state.errorCount} times
                            </Text>
                        )}
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    errorDetails: {
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        padding: 12,
        maxHeight: 200,
        width: '100%',
        marginBottom: 24,
    },
    errorText: {
        fontSize: 12,
        color: '#B91C1C',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    stackText: {
        fontSize: 10,
        color: '#DC2626',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 8,
    },
    buttonContainer: {
        gap: 12,
        width: '100%',
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    secondaryButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
    },
    recurringText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 16,
    },
});

export default GlobalErrorBoundary;
