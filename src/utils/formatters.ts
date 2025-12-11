// Date and time formatting utilities
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

export const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
};

// Currency formatting
export const formatCurrency = (amount: number, currency: string = 'AUD'): string => {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `$${amount.toFixed(2)}`;
  }
};

// Distance formatting
export const formatDistance = (distanceInMeters: number): string => {
  if (typeof distanceInMeters !== 'number' || isNaN(distanceInMeters)) return '0 m';
  
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)} m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }
};

// Duration formatting
export const formatDuration = (durationInMinutes: number): string => {
  if (typeof durationInMinutes !== 'number' || isNaN(durationInMinutes)) return '0 min';
  
  if (durationInMinutes < 60) {
    return `${Math.round(durationInMinutes)} min`;
  } else {
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = Math.round(durationInMinutes % 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};

// Phone number formatting
export const formatPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Australian mobile format
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  // Australian landline format
  if (cleaned.length === 10 && (cleaned.startsWith('02') || cleaned.startsWith('03') || cleaned.startsWith('07') || cleaned.startsWith('08'))) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
  }
  
  // International format
  if (cleaned.length > 10) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  
  return phoneNumber;
};

// Capitalize first letter
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Format relative time (e.g., "2 hours ago", "in 3 days")
export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = date.getTime() - now.getTime();
    const diffInMinutes = Math.round(diffInMs / (1000 * 60));
    
    if (Math.abs(diffInMinutes) < 1) {
      return 'now';
    } else if (Math.abs(diffInMinutes) < 60) {
      return diffInMinutes > 0 ? `in ${diffInMinutes} min` : `${Math.abs(diffInMinutes)} min ago`;
    } else if (Math.abs(diffInMinutes) < 1440) { // 24 hours
      const hours = Math.round(diffInMinutes / 60);
      return hours > 0 ? `in ${hours}h` : `${Math.abs(hours)}h ago`;
    } else {
      const days = Math.round(diffInMinutes / 1440);
      return days > 0 ? `in ${days}d` : `${Math.abs(days)}d ago`;
    }
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
};