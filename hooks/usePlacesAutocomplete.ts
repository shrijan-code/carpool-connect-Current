import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Location } from '@/types';

declare global {
  interface Window {
    google?: any;
  }
}

interface UsePlacesAutocompleteOptions {
  onLocationSelect: (location: Location) => void;
  minLength?: number;
  debounceMs?: number;
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export const usePlacesAutocomplete = ({
  onLocationSelect,
  minLength = 3,
  debounceMs = 350
}: UsePlacesAutocompleteOptions) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webPlacesServiceRef = useRef<any>(null);
  const webAutocompleteServiceRef = useRef<any>(null);
  const hiddenMapDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<any>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Initialize Google Maps SDK for web
  useEffect(() => {
    if (Platform.OS !== 'web' || !GOOGLE_PLACES_API_KEY) return;

    const ensureScript = () => new Promise<void>((resolve, reject) => {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>('script[data-places-sdk="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&language=en&region=AU`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-places-sdk', '1');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps script failed to load'));
      document.head.appendChild(script);
    });

    ensureScript()
      .then(() => {
        if (!hiddenMapDivRef.current) {
          hiddenMapDivRef.current = document.createElement('div');
          hiddenMapDivRef.current.style.display = 'none';
          document.body.appendChild(hiddenMapDivRef.current);
        }
        webAutocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        webPlacesServiceRef.current = new window.google.maps.places.PlacesService(hiddenMapDivRef.current);
      })
      .catch((e) => {
        console.error('Failed to init Google Places JS SDK:', e);
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Generate session token for cost optimization
  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return sessionTokenRef.current;
  }, []);

  // Reset session token after place selection
  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  const getCityCoordinates = useCallback((address: string): { lat: number; lng: number } => {
    const lowerAddress = address.toLowerCase();

    if (lowerAddress.includes('sydney')) return { lat: -33.8688, lng: 151.2093 };
    if (lowerAddress.includes('melbourne')) return { lat: -37.8136, lng: 144.9631 };
    if (lowerAddress.includes('brisbane')) return { lat: -27.4698, lng: 153.0251 };
    if (lowerAddress.includes('perth')) return { lat: -31.9505, lng: 115.8605 };
    if (lowerAddress.includes('adelaide')) return { lat: -34.9285, lng: 138.6007 };
    if (lowerAddress.includes('canberra')) return { lat: -35.2809, lng: 149.1300 };
    if (lowerAddress.includes('gold coast')) return { lat: -28.0167, lng: 153.4000 };
    if (lowerAddress.includes('newcastle')) return { lat: -32.9267, lng: 151.7789 };

    // Default to Sydney
    return { lat: -33.8688, lng: 151.2093 };
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < minLength) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);

    try {
      // For now, always use mock data to avoid CORS issues
      // In production, you would use a proxy server or Firebase Functions
      console.log('Searching places for:', query);

      // Enhanced mock data with better Australian locations and full addresses
      const mockPredictions = [
        {
          description: `${query} Street, Sydney NSW 2000, Australia`,
          place_id: `mock_${query}_syd_${Date.now()}`,
          structured_formatting: {
            main_text: `${query} Street`,
            secondary_text: 'Sydney NSW 2000, Australia',
          },
        },
        {
          description: `${query} Road, Melbourne VIC 3000, Australia`,
          place_id: `mock_${query}_mel_${Date.now()}`,
          structured_formatting: {
            main_text: `${query} Road`,
            secondary_text: 'Melbourne VIC 3000, Australia',
          },
        },
        {
          description: `${query} Avenue, Brisbane QLD 4000, Australia`,
          place_id: `mock_${query}_bne_${Date.now()}`,
          structured_formatting: {
            main_text: `${query} Avenue`,
            secondary_text: 'Brisbane QLD 4000, Australia',
          },
        },
        {
          description: `${query} Drive, Perth WA 6000, Australia`,
          place_id: `mock_${query}_per_${Date.now()}`,
          structured_formatting: {
            main_text: `${query} Drive`,
            secondary_text: 'Perth WA 6000, Australia',
          },
        },
        {
          description: `${query} Close, Adelaide SA 5000, Australia`,
          place_id: `mock_${query}_adl_${Date.now()}`,
          structured_formatting: {
            main_text: `${query} Close`,
            secondary_text: 'Adelaide SA 5000, Australia',
          },
        },
      ];

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      setPredictions(mockPredictions.slice(0, 5));
      setShowPredictions(true);
    } catch (error) {
      console.error('Places search error:', error);
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsLoading(false);
    }
  }, [minLength]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= minLength) {
      debounceRef.current = setTimeout(() => searchPlaces(query), debounceMs);
    }
  }, [searchPlaces, minLength, debounceMs]);

  const handleTextChange = useCallback((text: string) => {
    setInputValue(text);
    if (text.length < minLength) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    debouncedSearch(text);
  }, [minLength, debouncedSearch]);

  const selectPlace = useCallback(async (prediction: any) => {
    setInputValue(prediction.description);
    setShowPredictions(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      let location: Location;

      if (GOOGLE_PLACES_API_KEY && !prediction.place_id.startsWith('mock_')) {
        if (Platform.OS === 'web' && window.google?.maps?.places && webPlacesServiceRef.current) {
          await new Promise<void>((resolve) => {
            webPlacesServiceRef.current.getDetails(
              { placeId: prediction.place_id, fields: ['name', 'formatted_address', 'geometry'] },
              (result: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
                  location = {
                    id: prediction.place_id,
                    name: result.name || prediction.description.split(',')[0],
                    address: result.formatted_address || prediction.description,
                    latitude: result.geometry.location.lat(),
                    longitude: result.geometry.location.lng(),
                  };
                  onLocationSelect(location);
                }
                resolve();
              }
            );
          });
          resetSessionToken();
          setIsLoading(false);
          return;
        }

        // Mobile place details API call
        const sessionToken = getSessionToken();
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?` +
          `place_id=${prediction.place_id}` +
          `&fields=name,formatted_address,geometry` +
          `&key=${GOOGLE_PLACES_API_KEY}` +
          `&sessiontoken=${sessionToken}`;

        const detailsResponse = await fetch(detailsUrl);
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          if (detailsData.status === 'OK' && detailsData.result?.geometry) {
            const result = detailsData.result;
            location = {
              id: prediction.place_id,
              name: result.name || prediction.description.split(',')[0],
              address: result.formatted_address || prediction.description,
              latitude: result.geometry.location.lat,
              longitude: result.geometry.location.lng,
            };
            onLocationSelect(location);
            resetSessionToken();
            setIsLoading(false);
            return;
          }
        }
      }

      // Always create location with full address from prediction
      const cityCoordinates = getCityCoordinates(prediction.description);
      location = {
        id: prediction.place_id,
        name: prediction.description.split(',')[0].trim(),
        address: prediction.description, // Always use full description as address
        latitude: cityCoordinates.lat + (Math.random() - 0.5) * 0.005,
        longitude: cityCoordinates.lng + (Math.random() - 0.5) * 0.005,
      };
      console.log('Created location from prediction:', location);
      onLocationSelect(location);
      resetSessionToken();
    } catch (error) {
      console.error('Error selecting place:', error);
      // Fallback location with full address
      const fallbackLocation: Location = {
        id: prediction.place_id,
        name: prediction.description.split(',')[0]?.trim() || 'Location',
        address: prediction.description, // Always use full description as address
        latitude: -33.8688 + (Math.random() - 0.5) * 0.1,
        longitude: 151.2093 + (Math.random() - 0.5) * 0.1,
      };
      console.log('Using fallback location:', fallbackLocation);
      onLocationSelect(fallbackLocation);
    } finally {
      setIsLoading(false);
    }
  }, [onLocationSelect, getSessionToken, resetSessionToken, getCityCoordinates]);

  const open = useCallback(() => {
    setFocused(true);
    if (predictions.length > 0) {
      setShowPredictions(true);
    }
  }, [predictions.length]);

  const close = useCallback(() => {
    setFocused(false);
    setShowPredictions(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  }, []);

  const clear = useCallback(() => {
    setInputValue('');
    setPredictions([]);
    setShowPredictions(false);
    resetSessionToken();
  }, [resetSessionToken]);

  return {
    inputValue,
    handleTextChange,
    predictions: Array.isArray(predictions) ? predictions : [],
    showPredictions,
    isLoading,
    focused,
    inputRef,
    open,
    close,
    clear,
    selectPlace,
    setShowPredictions,
    setFocused,
  };
};