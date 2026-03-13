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
        const { size, company, quantity, unit, material_type, quality_grade, length_feet, cost_per_unit } = req.body;

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
            unit: unit || 'pieces',
            material_type,
            quality_grade,
            length_feet,
            cost_per_unit
        }, req.user.id);

        const message = pipe.action === 'created'
            ? 'Pipe type created successfully'
            : pipe.action === 'reactivated'
                ? 'Existing pipe type restored and stock added successfully'
                : 'Existing pipe type found and stock added successfully';

        res.status(201).json({
            status: 'success',
            message,
            data: pipe
        });
    } catch (error) {
        next(error);
    }
};

export const addStock = async (req, res, next) => {
    try {
        const { pipe_id, quantity, unit, source_location, destination_location } = req.body;

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
            req.user.id,
            {
                source_location,
                destination_location
            }
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

        if (!data.pipe_inventory_id || !data.quantity || data.quantity <= 0 || !data.bore_id || !data.bore_type) {
            return res.status(400).json({
                status: 'fail',
                message: 'Pipe ID, bore type, bore ID, and positive quantity are required'
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

        if (!data.allocation_id || !data.quantity || data.quantity <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Allocation ID and positive quantity are required'
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

export const deletePipe = async (req, res) => {
    const { id } = req.params;
    console.log(`[Inventory - Pipes] Attempting to delete pipe ID: ${id}`);

    try {
        if (!id) {
            console.error(`[Inventory - Pipes] Delete failed. Reason: ID is required`);
            return res.status(400).json({
                status: 'fail',
                message: 'ID is required'
            });
        }

        const pipe = await inventoryService.deletePipe(id);

        if (!pipe) {
            console.error(`[Inventory - Pipes] Delete failed. Reason: Pipe type not found`);
            return res.status(404).json({
                status: 'fail',
                message: 'Pipe type not found'
            });
        }

        console.log(`[Inventory - Pipes] Pipe deleted successfully.`);
        res.json({
            status: 'success',
            message: 'Pipe type deleted successfully'
        });
    } catch (error) {
        console.error(`[Inventory - Pipes] Delete failed. Reason: ${error.message}`);
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error deleting pipe type'
        });
    }
};

export const getPipeTransactions = async (req, res, next) => {
    try {
        const filters = {
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            transactionType: req.query.transaction_type,
            company: req.query.company,
            size: req.query.size,
            page: req.query.page,
            limit: req.query.limit,
        };

        const result = await inventoryService.getPipeTransactions(filters);

        res.json({
            status: 'success',
            data: result.records,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

export const getPipeAllocations = async (req, res, next) => {
    try {
        const allocations = await inventoryService.getPipeAllocations();
        res.json({
            status: 'success',
            data: allocations
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// PIPE COMPANIES CONTROLLERS
// =============================================

export const getPipeCompanies = async (req, res, next) => {
    try {
        const companies = await inventoryService.getAllPipeCompanies();
        res.json({
            status: 'success',
            data: companies
        });
    } catch (error) {
        next(error);
    }
};

export const addPipeCompany = async (req, res) => {
    console.log(`[Inventory - Pipes Companies] Adding new company: ${req.body.company_name}`);
    try {
        const { company_name } = req.body;
        if (!company_name) {
            return res.status(400).json({ status: 'fail', message: 'Company name is required' });
        }

        const company = await inventoryService.addPipeCompany(company_name);
        console.log(`[Inventory - Pipes Companies] Company added successfully. ID: ${company.id}`);

        res.status(201).json({
            status: 'success',
            message: 'Pipe company added successfully',
            data: company
        });
    } catch (error) {
        console.error(`[Inventory - Pipes Companies] Add failed: ${error.message}`);
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error adding company'
        });
    }
};

export const updatePipeCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_name } = req.body;
        if (!company_name) {
            return res.status(400).json({ status: 'fail', message: 'Company name is required' });
        }

        const company = await inventoryService.updatePipeCompany(id, { company_name });

        res.json({
            status: 'success',
            message: 'Pipe company updated successfully',
            data: company
        });
    } catch (error) {
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error updating company'
        });
    }
};

export const deletePipeCompany = async (req, res) => {
    const { id } = req.params;
    console.log(`[Inventory - Pipes Companies] Attempting to delete company ID: ${id}`);

    try {
        if (!id) {
            return res.status(400).json({ status: 'fail', message: 'ID is required' });
        }

        await inventoryService.deletePipeCompany(id);

        console.log(`[Inventory - Pipes Companies] Company deleted successfully. ID: ${id}`);
        res.json({
            status: 'success',
            message: 'Company deleted successfully'
        });
    } catch (error) {
        console.error(`[Inventory - Pipes Companies] Delete blocked. Reason: ${error.message}`);
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error deleting company'
        });
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

        const spare = await inventoryService.addNewSpare(req.body, req.user.id);

        res.status(201).json({
            status: 'success',
            message: 'Spare added successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const addSpareStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity || parseFloat(quantity) <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Stock quantity must be greater than 0'
            });
        }

        const spare = await inventoryService.addSpareStock(parseInt(id), req.body, req.user.id);

        res.json({
            status: 'success',
            message: 'Spare stock updated successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const issueSpare = async (req, res, next) => {
    try {
        const { id } = req.params;
        const spare = await inventoryService.issueSpareToVehicle(parseInt(id), req.body, req.user.id);

        res.json({
            status: 'success',
            message: 'Spare updated successfully',
            data: spare
        });
    } catch (error) {
        next(error);
    }
};

export const returnSpare = async (req, res, next) => {
    try {
        const { id } = req.params;
        const spare = await inventoryService.returnSpareToHome(parseInt(id), req.body, req.user.id);

        res.json({
            status: 'success',
            message: 'Spare updated successfully',
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

export const deleteSpare = async (req, res) => {
    const { id } = req.params;
    console.log(`[Inventory - Spares] Attempting to delete spare ID: ${id}`);

    try {
        if (!id) {
            console.error(`[Inventory - Spares] Delete failed. Reason: ID is required`);
            return res.status(400).json({
                status: 'fail',
                message: 'ID is required'
            });
        }

        await inventoryService.deleteSpare(parseInt(id));

        console.log(`[Inventory - Spares] Spare deleted successfully.`);
        res.json({
            status: 'success',
            message: 'Spare deleted successfully'
        });
    } catch (error) {
        console.error(`[Inventory - Spares] Delete failed. Reason: ${error.message}`);
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error deleting spare'
        });
    }
};

export const getSparesTransactions = async (req, res, next) => {
    try {
        const options = {
            spareId: req.query.spare_id,
            spareName: req.query.spare_name,
            transactionType: req.query.transaction_type,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            page: req.query.page,
            limit: req.query.limit,
        };

        const result = await inventoryService.getSparesTransactions(options);

        res.json({
            status: 'success',
            data: result.records,
            pagination: result.pagination,
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
            truckType: req.query.truck_type,
            vehicleNumber: req.query.vehicle_number,
            transactionType: req.query.transaction_type,
            supervisor: req.query.supervisor,
            page: req.query.page,
            limit: req.query.limit,
        };

        const result = await inventoryService.getAllDieselRecords(filters);

        res.json({
            status: 'success',
            data: result.records,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

export const createDieselRecord = async (req, res, next) => {
    try {
        const { truck_type, vehicle_name, purchase_date, amount, liters } = req.body;

        if ((!truck_type && !vehicle_name) || !purchase_date || !amount || !liters || parseFloat(liters) <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Truck type or vehicle, purchase date, amount, and positive liters are required'
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

export const deleteDieselRecord = async (req, res) => {
    const { id } = req.params;
    console.log(`[Inventory - Diesel] Attempting to delete diesel record ID: ${id}`);

    try {
        if (!id) {
            console.error(`[Inventory - Diesel] Delete failed. Reason: ID is required`);
            return res.status(400).json({
                status: 'fail',
                message: 'ID is required'
            });
        }

        await inventoryService.deleteDieselRecord(parseInt(id));

        console.log(`[Inventory - Diesel] Diesel record deleted successfully.`);
        res.json({
            status: 'success',
            message: 'Diesel record deleted successfully'
        });
    } catch (error) {
        console.error(`[Inventory - Diesel] Delete failed. Reason: ${error.message}`);
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Error deleting diesel record'
        });
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

export const getDieselVehicleStatus = async (req, res, next) => {
    try {
        const vehicles = await inventoryService.getDieselVehicleStatus();

        res.json({
            status: 'success',
            data: vehicles,
        });
    } catch (error) {
        next(error);
    }
};

export const createDieselVehicle = async (req, res) => {
    try {
        const { truck_type, vehicle_number, tank_capacity } = req.body;

        if (!truck_type || !vehicle_number || !tank_capacity || parseFloat(tank_capacity) <= 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'Truck type, vehicle number, and positive tank capacity are required'
            });
        }

        const vehicle = await inventoryService.createDieselVehicle(req.body);

        res.status(201).json({
            status: 'success',
            message: 'Diesel vehicle added successfully',
            data: vehicle,
        });
    } catch (error) {
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Failed to add diesel vehicle'
        });
    }
};

export const deleteDieselVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'fail',
                message: 'ID is required',
            });
        }

        await inventoryService.deleteDieselVehicle(id);

        res.json({
            status: 'success',
            message: 'Diesel vehicle deleted successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: 'fail',
            message: error.message || 'Failed to delete diesel vehicle',
        });
    }
};

// =============================================
// INVENTORY SUMMARY
// =============================================

export const getSummary = async (req, res, next) => {
    try {
        const summary = await inventoryService.getInventorySummary();
        res.json({
            status: 'success',
            data: summary
        });
    } catch (error) {
        next(error);
    }
};
