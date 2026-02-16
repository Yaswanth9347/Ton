import { Button } from '../common/Button';
import { Card } from '../common/Card';

export function CheckInOutButtons({
    status,
    onCheckIn,
    onCheckOut,
    loading = false,
    error = null
}) {
    const isCheckedIn = status && status.status !== 'not_checked_in';
    const isCheckedOut = status && status.checkOut;
    const canCheckIn = !isCheckedIn;
    const canCheckOut = isCheckedIn && !isCheckedOut;

    return (
        <Card>
            <h3 className="card-title mb-4">Quick Actions</h3>

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            <div className="flex gap-4">
                <Button
                    variant="success"
                    size="lg"
                    onClick={onCheckIn}
                    disabled={!canCheckIn}
                    loading={loading}
                    style={{ flex: 1 }}
                >
                    ✓ Check In
                </Button>

                <Button
                    variant="danger"
                    size="lg"
                    onClick={onCheckOut}
                    disabled={!canCheckOut}
                    loading={loading}
                    style={{ flex: 1 }}
                >
                    ✕ Check Out
                </Button>
            </div>

            {isCheckedIn && !isCheckedOut && (
                <p className="text-muted mt-4" style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                    You are currently checked in. Don't forget to check out before leaving!
                </p>
            )}

            {isCheckedOut && (
                <p className="text-success mt-4" style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                    ✓ You have completed your attendance for today.
                </p>
            )}
        </Card>
    );
}
