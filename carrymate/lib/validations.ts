import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+61[0-9]{9}$/, 'Must be Australian mobile number'),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  community: z.enum(['nepali', 'indian', 'srilankan', 'filipino', 'other']),
});

export const loginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const tripSchema = z
  .object({
    fromCity: z.enum(['Canberra', 'Sydney', 'Melbourne']),
    toCity: z.enum(['Canberra', 'Sydney', 'Melbourne']),
    travelDate: z.string().min(1),
    departureTime: z.string().min(1),
    availableSpace: z.enum(['small', 'medium', 'large']),
    pricePerKg: z.number().min(5).max(50),
    maxWeight: z.number().min(1).max(20),
    maxItems: z.number().min(1).max(10),
    restrictions: z.array(z.string()),
    notes: z.string().max(200).optional(),
  })
  .refine((data) => data.fromCity !== data.toCity, {
    message: 'From and to cities must be different',
    path: ['toCity'],
  });

export const bookingSchema = z.object({
  recipientName: z.string().min(2),
  recipientPhone: z.string().regex(/^\+61[0-9]{9}$/),
  recipientCity: z.enum(['Canberra', 'Sydney', 'Melbourne']),
  itemDescription: z.string().min(20),
  itemCategory: z.enum([
    'food_homecooked',
    'food_packaged',
    'documents',
    'clothing',
    'gifts_small',
    'cultural_religious',
    'other',
  ]),
  estimatedWeight: z.number().min(0.1).max(20),
  pickupLocation: z.string().min(3),
});

export const onboardingSchema = z.object({
  bio: z.string().max(300).optional(),
  cities: z.array(z.enum(['Canberra', 'Sydney', 'Melbourne'])).min(1),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type TripFormData = z.infer<typeof tripSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;
