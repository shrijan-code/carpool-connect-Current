/**
 * Firebase Admin mocks for testing
 */

export interface MockDocumentSnapshot {
    id: string;
    exists: boolean;
    data: () => Record<string, unknown> | undefined;
    ref: MockDocumentReference;
}

export interface MockDocumentReference {
    id: string;
    update: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
}

export interface MockQuerySnapshot {
    empty: boolean;
    size: number;
    docs: MockDocumentSnapshot[];
    forEach: (callback: (doc: MockDocumentSnapshot) => void) => void;
}

export const createMockDocRef = (id: string): MockDocumentReference => ({
    id,
    update: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
});

export const createMockDocSnapshot = (
    id: string,
    data: Record<string, unknown> | undefined,
    exists = true
): MockDocumentSnapshot => {
    const ref = createMockDocRef(id);
    return {
        id,
        exists,
        data: () => data,
        ref,
    };
};

export const createMockQuerySnapshot = (
    docs: MockDocumentSnapshot[]
): MockQuerySnapshot => ({
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback) => docs.forEach(callback),
});

export const createMockFirestore = () => {
    const mockCollection = jest.fn();
    const mockDoc = jest.fn();
    const mockWhere = jest.fn();
    const mockGet = jest.fn();
    const mockLimit = jest.fn();

    const chainableMock = {
        collection: mockCollection,
        doc: mockDoc,
        where: mockWhere,
        get: mockGet,
        limit: mockLimit,
    };

    // Make methods chainable
    mockCollection.mockReturnValue(chainableMock);
    mockDoc.mockReturnValue(chainableMock);
    mockWhere.mockReturnValue(chainableMock);
    mockLimit.mockReturnValue(chainableMock);

    return {
        collection: mockCollection,
        doc: mockDoc,
        runTransaction: jest.fn(),
        _chainable: chainableMock,
        _mockGet: mockGet,
    };
};

export const mockFirestore = createMockFirestore();
