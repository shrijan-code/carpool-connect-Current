import { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { DeliveryService } from '@/services/delivery';
import { Delivery } from '@/types';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';

// Helper function to generate mock deliveries - defined as a regular function for proper hoisting
function generateMockDeliveries(userId: string, userRole: string): Delivery[] {
  // Create mock user data for better testing
  const mockBusiness1 = {
    id: 'business_1',
    name: 'Sarah Johnson',
    email: 'sarah@business.com',
    phone: '+61 400 789 012',
    address: 'Sydney CBD, NSW, Australia',
    businessType: 'Office Services',
    verified: true,
    rating: 4.5,
    totalDeliveries: 25,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
  };
  
  const mockDriver1 = {
    id: 'driver_1',
    name: 'Mike Chen',
    displayName: 'Mike Chen',
    email: 'mike@driver.com',
    phone: '+61 400 123 456',
    photoURL: '',
    role: 'driver' as const,
    canBeDriver: true,
    canBeRider: false,
    rating: 4.8,
    totalRides: 150,
    joinedDate: '2023-01-01',
    verified: true,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
  };
  
  const baseDeliveries = [
    {
      id: 'mock_1',
      businessId: userRole === 'business' || userRole === 'rider' ? userId : 'business_1',
      business: userRole === 'business' || userRole === 'rider' ? undefined : mockBusiness1,
      items: [
        { itemId: '1', name: 'Office Supplies', quantity: 1 },
        { itemId: '2', name: 'Documents', quantity: 3 },
      ],
      pickupLocation: {
        id: 'pickup_1',
        name: 'Sydney CBD',
        address: 'Sydney CBD, NSW, Australia',
        latitude: -33.8688,
        longitude: 151.2093,
      },
      dropoffLocation: {
        id: 'dropoff_1',
        name: 'Parramatta',
        address: 'Parramatta, NSW, Australia',
        latitude: -33.8150,
        longitude: 150.9999,
      },
      packageSize: 'medium' as const,
      specialInstructions: 'Handle with care - fragile documents',
      priceCents: 800,
      preferredTimeWindow: {
        start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
      },
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock_2',
      businessId: 'business_2',
      business: {
        id: 'business_2',
        name: 'Emma Wilson',
        email: 'emma@marketing.com',
        phone: '+61 400 555 123',
        address: 'Melbourne CBD, VIC, Australia',
        businessType: 'Marketing Agency',
        verified: true,
        rating: 4.7,
        totalDeliveries: 40,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      items: [
        { itemId: '3', name: 'Marketing Materials', quantity: 5 },
      ],
      pickupLocation: {
        id: 'pickup_2',
        name: 'Melbourne CBD',
        address: 'Melbourne CBD, VIC, Australia',
        latitude: -37.8136,
        longitude: 144.9631,
      },
      dropoffLocation: {
        id: 'dropoff_2',
        name: 'Richmond',
        address: 'Richmond, VIC, Australia',
        latitude: -37.8197,
        longitude: 144.9975,
      },
      packageSize: 'large' as const,
      specialInstructions: 'Urgent delivery needed',
      priceCents: 1200,
      preferredTimeWindow: {
        start: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
        end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
      },
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock_3',
      businessId: userRole === 'business' || userRole === 'rider' ? userId : 'business_3',
      business: userRole === 'business' || userRole === 'rider' ? undefined : {
        id: 'business_3',
        name: 'Tech Solutions Ltd',
        email: 'orders@techsolutions.com',
        phone: '+61 400 333 789',
        address: 'Brisbane CBD, QLD, Australia',
        businessType: 'Electronics',
        verified: true,
        rating: 4.6,
        totalDeliveries: 60,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      driverId: userRole === 'driver' ? userId : undefined,
      driver: userRole === 'driver' ? undefined : mockDriver1,
      items: [
        { itemId: '4', name: 'Electronics', quantity: 2 },
      ],
      pickupLocation: {
        id: 'pickup_3',
        name: 'Brisbane CBD',
        address: 'Brisbane CBD, QLD, Australia',
        latitude: -27.4698,
        longitude: 153.0251,
      },
      dropoffLocation: {
        id: 'dropoff_3',
        name: 'Gold Coast',
        address: 'Gold Coast, QLD, Australia',
        latitude: -28.0167,
        longitude: 153.4000,
      },
      packageSize: 'small' as const,
      specialInstructions: 'Fragile electronics - handle with extreme care',
      priceCents: 1500,
      preferredTimeWindow: {
        start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
        end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
      },
      status: (userRole === 'driver' ? 'matched' : 'pending') as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock_5',
      businessId: userRole === 'business' || userRole === 'rider' ? userId : 'business_5',
      business: userRole === 'business' || userRole === 'rider' ? undefined : {
        id: 'business_5',
        name: 'Digital Solutions Inc',
        email: 'orders@digitalsolutions.com',
        phone: '+61 400 888 999',
        address: 'Adelaide CBD, SA, Australia',
        businessType: 'Technology',
        verified: true,
        rating: 4.9,
        totalDeliveries: 120,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      driverId: userRole === 'driver' ? userId : 'driver_2',
      driver: userRole === 'driver' ? {
        id: userId,
        name: 'Current Driver',
        displayName: 'Current Driver',
        email: 'driver@example.com',
        phone: '+61 400 123 456',
        photoURL: '',
        role: 'driver' as const,
        canBeDriver: true,
        canBeRider: false,
        rating: 4.8,
        totalRides: 150,
        joinedDate: '2023-01-01',
        verified: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      } : {
        id: 'driver_2',
        name: 'Alex Thompson',
        displayName: 'Alex Thompson',
        email: 'alex@driver.com',
        phone: '+61 400 987 654',
        photoURL: '',
        role: 'driver' as const,
        canBeDriver: true,
        canBeRider: false,
        rating: 4.9,
        totalRides: 200,
        joinedDate: '2023-01-01',
        verified: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      items: [
        { itemId: '6', name: 'Software Equipment', quantity: 1 },
      ],
      pickupLocation: {
        id: 'pickup_5',
        name: 'Adelaide CBD',
        address: 'Adelaide CBD, SA, Australia',
        latitude: -34.9285,
        longitude: 138.6007,
      },
      dropoffLocation: {
        id: 'dropoff_5',
        name: 'Glenelg',
        address: 'Glenelg, SA, Australia',
        latitude: -34.9805,
        longitude: 138.5133,
      },
      packageSize: 'medium' as const,
      specialInstructions: 'Completed delivery - handle with care',
      priceCents: 1000,
      preferredTimeWindow: {
        start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago (PAST)
        end: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 2 days ago + 4 hours
      },
      status: 'delivered' as const,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock_6',
      businessId: userRole === 'business' || userRole === 'rider' ? userId : 'business_6',
      business: userRole === 'business' || userRole === 'rider' ? undefined : {
        id: 'business_6',
        name: 'Quick Logistics',
        email: 'support@quicklogistics.com',
        phone: '+61 400 111 222',
        address: 'Darwin CBD, NT, Australia',
        businessType: 'Logistics',
        verified: true,
        rating: 4.2,
        totalDeliveries: 75,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      driverId: userRole === 'driver' ? userId : 'driver_3',
      driver: userRole === 'driver' ? {
        id: userId,
        name: 'Current Driver',
        displayName: 'Current Driver',
        email: 'driver@example.com',
        phone: '+61 400 123 456',
        photoURL: '',
        role: 'driver' as const,
        canBeDriver: true,
        canBeRider: false,
        rating: 4.8,
        totalRides: 150,
        joinedDate: '2023-01-01',
        verified: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      } : {
        id: 'driver_3',
        name: 'Jordan Lee',
        displayName: 'Jordan Lee',
        email: 'jordan@driver.com',
        phone: '+61 400 555 777',
        photoURL: '',
        role: 'driver' as const,
        canBeDriver: true,
        canBeRider: false,
        rating: 4.6,
        totalRides: 120,
        joinedDate: '2023-01-01',
        verified: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      items: [
        { itemId: '7', name: 'Cancelled Package', quantity: 2 },
      ],
      pickupLocation: {
        id: 'pickup_6',
        name: 'Darwin CBD',
        address: 'Darwin CBD, NT, Australia',
        latitude: -12.4634,
        longitude: 130.8456,
      },
      dropoffLocation: {
        id: 'dropoff_6',
        name: 'Palmerston',
        address: 'Palmerston, NT, Australia',
        latitude: -12.4823,
        longitude: 130.9839,
      },
      packageSize: 'large' as const,
      specialInstructions: 'Cancelled due to address issues',
      priceCents: 900,
      preferredTimeWindow: {
        start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago (PAST)
        end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 1 day ago + 4 hours
      },
      status: 'cancelled' as const,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock_4',
      businessId: 'business_4',
      business: {
        id: 'business_4',
        name: 'Fresh Foods Co',
        email: 'delivery@freshfoods.com',
        phone: '+61 400 777 456',
        address: 'Perth CBD, WA, Australia',
        businessType: 'Food & Beverage',
        verified: true,
        rating: 4.3,
        totalDeliveries: 80,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      items: [
        { itemId: '5', name: 'Food Delivery', quantity: 1 },
      ],
      pickupLocation: {
        id: 'pickup_4',
        name: 'Perth CBD',
        address: 'Perth CBD, WA, Australia',
        latitude: -31.9505,
        longitude: 115.8605,
      },
      dropoffLocation: {
        id: 'dropoff_4',
        name: 'Fremantle',
        address: 'Fremantle, WA, Australia',
        latitude: -32.0569,
        longitude: 115.7439,
      },
      packageSize: 'small' as const,
      specialInstructions: 'Keep refrigerated',
      priceCents: 600,
      preferredTimeWindow: {
        start: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      },
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Filter deliveries based on user role and add proper user data
  if (userRole === 'driver') {
    // Show available deliveries and ones assigned to this driver
    // Filter out past pending deliveries for drivers (they can only accept future deliveries)
    const now = new Date();
    return baseDeliveries.map(delivery => {
      if (delivery.id === 'mock_3' || delivery.id === 'mock_5' || delivery.id === 'mock_6') {
        return { 
          ...delivery, 
          driverId: userId, 
          driver: {
            id: userId,
            name: 'Current Driver',
            displayName: 'Current Driver',
            email: 'driver@example.com',
            phone: '+61 400 123 456',
            photoURL: '',
            role: 'driver' as const,
            canBeDriver: true,
            canBeRider: false,
            rating: 4.8,
            totalRides: 150,
            joinedDate: '2023-01-01',
            verified: true,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
          }
        };
      }
      return delivery;
    }).filter(delivery => {
      // For drivers: only show future pending deliveries or deliveries assigned to them
      if (delivery.status === 'pending' && delivery.driverId !== userId) {
        const deliveryTime = new Date(delivery.preferredTimeWindow.start);
        return deliveryTime.getTime() > now.getTime(); // Only future pending deliveries
      }
      return true; // Show all assigned deliveries (past and future)
    });
  }

  // For business users, make sure they own some completed/cancelled deliveries
  // Business users see all their deliveries (past and future)
  if (userRole === 'business' || userRole === 'rider') {
    return baseDeliveries.map(delivery => {
      if (delivery.id === 'mock_5' || delivery.id === 'mock_6') {
        return {
          ...delivery,
          businessId: userId,
          business: {
            id: userId,
            name: 'Current Business',
            email: 'business@example.com',
            phone: '+61 400 123 456',
            address: 'Current Location',
            businessType: 'General',
            verified: true,
            rating: 4.5,
            totalDeliveries: 15,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
          }
        };
      }
      return delivery;
    });
  }

  return baseDeliveries;
}

export const [DeliveryProvider, useDeliveryStore] = createContextHook(() => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [firebaseFunctionsAvailable, setFirebaseFunctionsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Test Firestore connectivity on initialization
  useEffect(() => {
    const testConnectivity = async () => {
      try {
        // Test Firestore connectivity by trying to read from deliveries collection with limit
        const q = query(collection(db, 'deliveries'), orderBy('createdAt', 'desc'), limit(1));
        await getDocs(q);
        setFirebaseFunctionsAvailable(true);
        console.log('✅ Firestore connectivity test successful');
      } catch (error) {
        console.log('⚠️ Firestore not available, using mock data for demo:', error);
        setFirebaseFunctionsAvailable(false);
      }
    };
    testConnectivity();
  }, []);


  const fetchDeliveries = useCallback(async (userId: string, userRole: string) => {
    if (!userId || !userRole) {
      console.warn('Invalid userId or userRole provided to fetchDeliveries');
      return [];
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching deliveries from store for:', { userId, userRole });
      const { deliveries: fetched, nextCursor } = await DeliveryService.getDeliveries(userId, userRole as any);
      console.log('Successfully fetched deliveries:', fetched.length, 'nextCursor:', !!nextCursor);
      setDeliveries(fetched);
      setError(null);
      setFirebaseFunctionsAvailable(true); // Firestore is working
      return fetched;
    } catch (error) {
      console.log('Failed to fetch deliveries from Firestore:', error);
      
      // Check if it's a Firestore error or other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const isFirestoreError = errorMessage.includes('firestore') || 
                              errorMessage.includes('permission') || 
                              errorMessage.includes('index') ||
                              errorMessage.includes('Missing or insufficient permissions');
      
      if (isFirestoreError) {
        console.log('Firestore error detected, using mock data for demo');
        setError('Firestore connection issue - using demo data');
        setFirebaseFunctionsAvailable(false);
      } else {
        console.log('Other error detected, using mock data for demo');
        setError('Service unavailable - using demo data');
        setFirebaseFunctionsAvailable(false);
      }
      
      // Generate mock data based on user role and ID
      const mockDeliveries: Delivery[] = generateMockDeliveries(userId, userRole);
      
      console.log('📦 Using mock deliveries:', mockDeliveries.length);
      setDeliveries(mockDeliveries);
      return mockDeliveries;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshDeliveries = useCallback(async (userId: string, userRole: string) => {
    return await fetchDeliveries(userId, userRole);
  }, [fetchDeliveries]);

  return useMemo(() => ({
    deliveries,
    isLoading,
    error,
    firebaseFunctionsAvailable,
    fetchDeliveries,
    refreshDeliveries,
    setDeliveries,
    setError,
  }), [deliveries, isLoading, error, firebaseFunctionsAvailable, fetchDeliveries, refreshDeliveries]);
});

// Legacy export for backward compatibility
export const useDelivery = useDeliveryStore;