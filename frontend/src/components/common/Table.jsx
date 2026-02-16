export function Table({ children, className = '' }) {
    return (
        <div className="table-container">
            <table className={`table ${className}`}>
                {children}
            </table>
        </div>
    );
}

export function TableHead({ children }) {
    return <thead>{children}</thead>;
}

export function TableBody({ children }) {
    return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = '' }) {
    return <tr className={className}>{children}</tr>;
}

export function TableHeader({ children, className = '' }) {
    return <th className={className}>{children}</th>;
}

export function TableCell({ children, className = '' }) {
    return <td className={className}>{children}</td>;
}
