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

    const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                resolve(null); // Geolocation not supported
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        address: 'Current Location' // In a real app, use reverse geocoding
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    resolve(null); // Proceed without location if denied
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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
