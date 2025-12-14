// Define React Native globals for node environment
(global as any).__DEV__ = true;

// Mock React Native core modules
jest.mock('react-native', () => ({
    Platform: { OS: 'ios', select: jest.fn((obj: any) => obj.ios) },
    NativeModules: {},
    TurboModuleRegistry: {
        get: jest.fn(),
        getEnforcing: jest.fn(),
    },
    NativeEventEmitter: jest.fn(() => ({
        addListener: jest.fn(),
        removeListeners: jest.fn(),
    })),
}));

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
    get: jest.fn(),
    getEnforcing: jest.fn(),
}));

// Mock Expo modules that access platform-specific APIs
jest.mock('expo-constants', () => ({
    default: {
        expoConfig: { extra: {} },
        manifest: {},
    },
}));

jest.mock('expo-modules-core', () => ({
    NativeModulesProxy: {},
    requireNativeModule: jest.fn(),
    Platform: { OS: 'ios' },
}));

// Mock Expo auth and browser modules
jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
    openBrowserAsync: jest.fn(),
    openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
    useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
    ResponseType: { Token: 'token' },
    makeRedirectUri: jest.fn(() => 'test://redirect'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
    useIdTokenAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));

// Try to extend expect with jest-native matchers (may fail in node environment)
try {
    require('@testing-library/jest-native/extend-expect');
} catch (e) {
    // Ignore - running in node environment without React Native
}

// Mock Firebase modules
jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('firebase/storage', () => ({
    getStorage: jest.fn(),
    ref: jest.fn(),
    uploadBytes: jest.fn(),
    getDownloadURL: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(),
    httpsCallable: jest.fn(() => jest.fn()),
}));

// Mock Expo modules
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({
        coords: { latitude: -33.8688, longitude: 151.2093 }
    })),
}));

jest.mock('expo-notifications', () => ({
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
    setNotificationHandler: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(),
}));

// Mock React Native modules (may fail in pure node environment)
try {
    jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
} catch (e) {
    // Ignore - running in node environment
}

// Mock global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
) as jest.Mock;

// Silence console warnings during tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};
