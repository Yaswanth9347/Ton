import { useState, useEffect, useCallback } from 'react';
import { attendanceApi } from '../services/api';

export function useAttendance() {
    const [todayStatus, setTodayStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTodayStatus = useCallback(async () => {
        try {
            const response = await attendanceApi.getToday();
            setTodayStatus(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch today status');
        }
    }, []);

    const fetchHistory = useCallback(async (params = {}) => {
        try {
            const response = await attendanceApi.getHistory(params);
            setHistory(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch history');
        }
    }, []);

    const reverseGeocode = async (latitude, longitude) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=16`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'JMJManagementSystem/1.0',
                    },
                }
            );
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();
            const addr = data.address || {};
            // Build a concise, readable location string
            const parts = [
                addr.neighbourhood || addr.suburb || addr.hamlet || '',
                addr.city || addr.town || addr.village || addr.county || '',
                addr.state || '',
            ].filter(Boolean);
            return parts.length > 0 ? parts.slice(0, 2).join(', ') : data.display_name?.split(',').slice(0, 2).join(',').trim() || null;
        } catch (err) {
            console.warn('Reverse geocoding failed:', err.message);
            return null;
        }
    };

    const getCurrentLocation = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null); // Geolocation not supported
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    // Attempt reverse geocoding; fall back to coordinate string
                    const placeName = await reverseGeocode(latitude, longitude);
                    const address = placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    resolve({ latitude, longitude, address });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    resolve(null); // Proceed without location if denied
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    };

    const checkIn = async () => {
        setError(null);
        try {
            const location = await getCurrentLocation();
            const response = await attendanceApi.checkIn(location);
            setTodayStatus(response.data.data);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to check in';
            setError(message);
            throw new Error(message);
        }
    };

    const checkOut = async () => {
        setError(null);
        try {
            const location = await getCurrentLocation();
            const response = await attendanceApi.checkOut(location);
            setTodayStatus(response.data.data);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to check out';
            setError(message);
            throw new Error(message);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchTodayStatus(), fetchHistory()]);
            setLoading(false);
        };
        loadData();
    }, [fetchTodayStatus, fetchHistory]);

    return {
        todayStatus,
        history,
        loading,
        error,
        checkIn,
        checkOut,
        refreshTodayStatus: fetchTodayStatus,
        refreshHistory: fetchHistory,
    };
}
