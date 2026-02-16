export function Button({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    className = '',
    ...props
}) {
    const sizeClass = size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : '';

    return (
        <button
            className={`btn btn-${variant} ${sizeClass} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <span className="spinner" style={{ width: '1rem', height: '1rem' }} />
                    Loading...
                </>
            ) : (
                children
            )}
        </button>
    );
}
