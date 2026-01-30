interface UpliftAlertProps {
    potentialUplift: number;
    linkCount: number;
    currency: string;
}

export default function UpliftAlert({ potentialUplift, linkCount, currency }: UpliftAlertProps) {
    return (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <h3 className="text-amber-400 font-semibold">
                💰 Potential uplift of {currency}{potentialUplift.toFixed(2)} found across {linkCount} links
            </h3>
        </div>
    );
}
