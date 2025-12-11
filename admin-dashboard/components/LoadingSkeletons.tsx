/**
 * Loading skeleton components for admin dashboard
 */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="flex gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-4 bg-gray-200 rounded w-24"></div>
                        ))}
                    </div>
                </div>

                {/* Rows */}
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="px-6 py-4 border-b border-gray-200 last:border-0">
                        <div className="flex gap-4 items-center">
                            {[...Array(4)].map((_, j) => (
                                <div key={j} className="h-4 bg-gray-200 rounded flex-1"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
            </div>
        </div>
    );
}

export function StatCardSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
            </div>
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>

            {/* Content card */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i}>
                            <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ListSkeleton({ items = 10 }: { items?: number }) {
    return (
        <div className="animate-pulse space-y-3">
            {[...Array(items)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
