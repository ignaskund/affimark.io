interface UpliftAlertProps {
    potentialUplift: number;
    linkCount: number;
    currency: string;
}

export default function UpliftAlert({ potentialUplift, linkCount, currency }: UpliftAlertProps) {
    return (
        <div className="p-4 rounded-xl" style={{ background: 'var(--color-warning-soft)', borderColor: 'var(--color-warning)', borderWidth: '1.5px', borderStyle: 'solid' }}>
            <h3 className="font-semibold" style={{ color: 'var(--color-warning)' }}>
                💰 Potential uplift of {currency}{potentialUplift.toFixed(2)} found across {linkCount} links
            </h3>
        </div>
    );
}
