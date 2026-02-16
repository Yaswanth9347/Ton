import { useState, useEffect } from 'react';
import { Button } from '../common/Button';

const ROLE_SALARIES = {
    EMPLOYEE: 12000,
    SUPERVISOR: 15000,
};

export function EmployeeForm({ employee, onSubmit, onCancel, loading = false, error = null }) {
    const isEditing = !!employee;

    const [formData, setFormData] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                username: employee.username || '',
                firstName: employee.firstName || '',
                lastName: employee.lastName || '',
                email: employee.email || '',
                password: '',
                role: employee.role || 'EMPLOYEE',
            });
        } else {
            setFormData({
                username: '',
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                role: 'EMPLOYEE',
            });
        }
    }, [employee]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // If editing and password is empty, don't include it
        const data = { ...formData };
        if (isEditing && !data.password) {
            delete data.password;
        }

        onSubmit(data);
    };

    const selectedSalary = ROLE_SALARIES[formData.role] || 0;

    return (
        <form onSubmit={handleSubmit}>
            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            <div className="form-group">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                    id="username"
                    name="username"
                    type="text"
                    className="form-input"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="johndoe"
                    pattern="^[a-zA-Z0-9_]+$"
                    title="Username can only contain letters, numbers, and underscores"
                />
            </div>

            <div className="form-group">
                <label htmlFor="firstName" className="form-label">First Name</label>
                <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="form-input"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    placeholder="John"
                />
            </div>

            <div className="form-group">
                <label htmlFor="lastName" className="form-label">Last Name</label>
                <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="form-input"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    placeholder="Doe"
                />
            </div>

            <div className="form-group">
                <label htmlFor="email" className="form-label">
                    Email <span className="text-muted">(optional)</span>
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john.doe@company.com"
                />
            </div>

            <div className="form-group">
                <label htmlFor="role" className="form-label">Role</label>
                <select
                    id="role"
                    name="role"
                    className="form-input"
                    value={formData.role}
                    onChange={handleChange}
                >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="SUPERVISOR">Supervisor</option>
                </select>
                <div className="text-muted text-xs mt-1">
                    Auto-assigned salary: ₹{selectedSalary.toLocaleString('en-IN')} /month
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="password" className="form-label">
                    Password {isEditing && <span className="text-muted">(leave blank to keep current)</span>}
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-input"
                    value={formData.password}
                    onChange={handleChange}
                    required={!isEditing}
                    minLength={8}
                    placeholder={isEditing ? '••••••••' : 'Minimum 8 characters'}
                />
            </div>

            <div className="flex gap-4 mt-6">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" loading={loading}>
                    {isEditing ? 'Update Employee' : 'Add Employee'}
                </Button>
            </div>
        </form>
    );
}
