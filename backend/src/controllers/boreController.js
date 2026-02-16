import * as boreService from '../services/boreService.js';
import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwt.js';

/**
 * Get all borewell records
 * GET /api/bores
 */
export const getAllRecords = async (req, res, next) => {
    try {
        const { search } = req.query;
        const records = await boreService.getAllRecords(search);

        res.json({
            success: true,
            data: records,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single borewell record
 * GET /api/bores/:id
 */
export const getRecord = async (req, res, next) => {
    try {
        const record = await boreService.getRecordById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        res.json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new borewell record
 * POST /api/bores
 */
export const createRecord = async (req, res, next) => {
    try {
        const record = await boreService.createRecord(req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a borewell record
 * PUT /api/bores/:id
 */
export const updateRecord = async (req, res, next) => {
    try {
        const record = await boreService.updateRecord(req.params.id, req.body);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        res.json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a borewell record
 * DELETE /api/bores/:id
 */
export const deleteRecord = async (req, res, next) => {
    try {
        const record = await boreService.deleteRecord(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        res.json({
            success: true,
            message: 'Record deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Download receipt for a borewell record
 * GET /api/bores/:id/receipt
 * Auth via query param ?token= (since window.open can't send Authorization header)
 */
export const downloadReceipt = async (req, res, next) => {
    try {
        // Authenticate via query token
        const token = req.query.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token required' });
        }

        try {
            jwt.verify(token, jwtConfig.secret);
        } catch {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        const record = await boreService.getRecordById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        const html = boreService.generateBoreReceipt(record);

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        next(error);
    }
};
