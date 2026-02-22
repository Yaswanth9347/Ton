import * as inventoryService from '../services/inventoryService.js';

// =============================================
// PIPES CONTROLLERS
// =============================================

export const getPipes = async (req, res, next) => {
    try {
        const pipes = await inventoryService.getAllPipes();
        res.json({
            status: 'success',
            data: pipes
        });
    } catch (error) {
        next(error);
    }
};

export const createPipe = async (req, res, next) => {
    try {
        const { size, company, quantity, unit } = req.body;

        if (!size || !company) {
            return res.status(400).json({
                status: 'fail',
                message: 'Size and company are required'
            });
        }

        const pipe = await inventoryService.createNewPipe({
            size,
            company,
            quantity: quantity || 0,
            unit: unit || 'pieces'
        });

        res.status(201).json({
            status: 'success',
            message: 'Pipe type created successfully',
            data: pipe
        });
    } catch (error) {
        next(error);
    }
};

export const addStock = async (req, res, next) => {
    try {
        const { pipe_id, quantity, unit } = req.body;

        if (!pipe_id || !quantity || quantity <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Pipe ID and positive quantity are required'
            });
        }

        const updatedPipe = await inventoryService.addPipeStock(
            pipe_id,
            parseFloat(quantity),
            unit || 'pipes',
            req.user.id
        );

        res.json({
            status: 'success',
            message: 'Stock added successfully',
            data: updatedPipe
        });
    } catch (error) {
        next(error);
    }
};

export const issuePipes = async (req, res, next) => {
    try {
        const data = req.body;

        if (!data.pipe_inventory_id || !data.quantity || data.quantity <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Pipe ID and positive quantity are required'
            });
        }

        const updatedPipe = await inventoryService.issuePipesToBore(data, req.user.id);

        res.json({
            status: 'success',
            message: 'Pipes issued successfully',
            data: updatedPipe
        });
    } catch (error) {
        next(error);
    }
};

export const returnPipes = async (req, res, next) => {
    try {
        const data = req.body;

        if (!data.pipe_inventory_id || !data.quantity || data.quantity <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Pipe ID and positive quantity are required'
            });
        }

        const updatedPipe = await inventoryService.returnPipesFromBore(data, req.user.id);

        res.json({
            status: 'success',
            message: 'Pipes returned successfully',
            data: updatedPipe
        });
    } catch (error) {
        next(error);
    }
};

export const deletePipe = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'fail',
                message: 'ID is required'
            });
        }

        const pipe = await inventoryService.deletePipe(id);

        if (!pipe) {
            return res.status(404).json({
                status: 'fail',
                message: 'Pipe type not found'
            });
        }

        res.json({
            status: 'success',
            message: 'Pipe type deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getPipeTransactions = async (req, res, next) => {
    try {
        const filters = {
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            transactionType: req.query.transaction_type
        };

        const transactions = await inventoryService.getPipeTransactions(filters);

        res.json({
            status: 'success',
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// SPARES CONTROLLERS
// =============================================

export const getSpares = async (req, res, next) => {
    try {
        const filters = {
            spareType: req.query.spare_type,
            status: req.query.status,
            location: req.query.location
        };

        const spares = await inventoryService.getAllSpares(filters);

        res.json({
            status: 'success',
            data: spares
        });
    } catch (error) {
        next(error);
    }
};

export const createSpare = async (req, res, next) => {
    try {
        const { spare_type, spare_number } = req.body;

        if (!spare_type || !spare_number) {
            return res.status(400).json({
                status: 'fail',
                message: 'Spare type and number are required'
            });
        }

        const spare = await inventoryService.addNewSpare(req.body);

        res.status(201).json({
            status: 'success',
            message: 'Spare added successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const issueSpare = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { vehicle_name, supervisor_name, remarks } = req.body;

        if (!vehicle_name) {
            return res.status(400).json({
                status: 'fail',
                message: 'Vehicle name is required'
            });
        }

        const spare = await inventoryService.issueSpareToVehicle(
            parseInt(id),
            { vehicle_name, supervisor_name, remarks },
            req.user.id
        );

        res.json({
            status: 'success',
            message: 'Spare issued successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const returnSpare = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const spare = await inventoryService.returnSpareToHome(
            parseInt(id),
            { remarks },
            req.user.id
        );

        res.json({
            status: 'success',
            message: 'Spare returned successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const updateSpareStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                status: 'fail',
                message: 'Status is required'
            });
        }

        const spare = await inventoryService.updateSpareStatus(parseInt(id), status);

        res.json({
            status: 'success',
            message: 'Spare status updated successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const deleteSpare = async (req, res, next) => {
    try {
        const { id } = req.params;

        await inventoryService.deleteSpare(parseInt(id));

        res.json({
            status: 'success',
            message: 'Spare deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getSparesTransactions = async (req, res, next) => {
    try {
        const spareId = req.query.spare_id ? parseInt(req.query.spare_id) : null;
        const transactions = await inventoryService.getSparesTransactions(spareId);

        res.json({
            status: 'success',
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// DIESEL CONTROLLERS
// =============================================

export const getDieselRecords = async (req, res, next) => {
    try {
        const filters = {
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            vehicle: req.query.vehicle,
            supervisor: req.query.supervisor
        };

        const records = await inventoryService.getAllDieselRecords(filters);

        res.json({
            status: 'success',
            data: records
        });
    } catch (error) {
        next(error);
    }
};

export const createDieselRecord = async (req, res, next) => {
    try {
        const { vehicle_name, purchase_date, amount } = req.body;

        if (!vehicle_name || !purchase_date || !amount) {
            return res.status(400).json({
                status: 'fail',
                message: 'Vehicle name, purchase date, and amount are required'
            });
        }

        const record = await inventoryService.addDieselRecord(req.body, req.user.id);

        res.status(201).json({
            status: 'success',
            message: 'Diesel record added successfully',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

export const updateDieselRecord = async (req, res, next) => {
    try {
        const { id } = req.params;

        const record = await inventoryService.updateDieselRecord(parseInt(id), req.body);

        res.json({
            status: 'success',
            message: 'Diesel record updated successfully',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

export const deleteDieselRecord = async (req, res, next) => {
    try {
        const { id } = req.params;

        await inventoryService.deleteDieselRecord(parseInt(id));

        res.json({
            status: 'success',
            message: 'Diesel record deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getDieselSummary = async (req, res, next) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'fail',
                message: 'Start date and end date are required'
            });
        }

        const summary = await inventoryService.getDieselSummary(start_date, end_date);

        res.json({
            status: 'success',
            data: summary
        });
    } catch (error) {
        next(error);
    }
};
