'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, getSeverityColor, getStatusColor } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

// Helper function to safely render any value as a string
const safeRender = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    // Handle Firestore Timestamp-like objects
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if ('toDate' in obj && typeof obj.toDate === 'function') {
            return (obj.toDate as () => Date)().toISOString();
        }
        if ('_seconds' in obj || 'seconds' in obj) {
            const seconds = (obj._seconds || obj.seconds) as number;
            return new Date(seconds * 1000).toISOString();
        }
    }
    // Fallback: stringify the object
    try {
        return JSON.stringify(value);
    } catch {
        return '[Object]';
    }
};

export default function SafetyReportDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState('');
    const [newStatus, setNewStatus] = useState('');

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        const res = await fetch(`/api/safety-reports/${params.id}`);
        const data = await res.json();
        setReport(data.report);
        setNewStatus(data.report?.status || '');
        setLoading(false);
    };

    const handleUpdateStatus = async () => {
        await fetch(`/api/safety-reports/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        fetchReport();
    };

    const handleAddNote = async () => {
        if (!note.trim()) return;
        await fetch(`/api/safety-reports/${params.id}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note }),
        });
        setNote('');
        fetchReport();
    };

    if (loading) return <div className="text-center py-12">Loading...</div>;
    if (!report) return <div className="text-center py-12">Report not found</div>;

    return (
        <div>
            <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Reports
            </button>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Safety Report</h1>
                        <p className="text-gray-600">ID: {safeRender(report.id)}</p>
                    </div>
                    <div className="flex gap-2">
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getSeverityColor(safeRender(report.severity))}`}>
                            {safeRender(report.severity)}
                        </span>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(safeRender(report.status))}`}>
                            {safeRender(report.status)}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Type</h3>
                        <p className="text-gray-900">{safeRender(report.type).replace('_', ' ') || 'Unknown'}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
                        <p className="text-gray-900">{formatDate(safeRender(report.createdAt))}</p>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                    <p className="text-gray-900 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                        {typeof report.description === 'string' ? report.description : JSON.stringify(report.description, null, 2)}
                    </p>
                </div>

                {report.location && (
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
                        <p className="text-gray-900">
                            {report.location.address || `Lat: ${report.location.latitude}, Lng: ${report.location.longitude}`}
                        </p>
                    </div>
                )}

                {report.evidence && (
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Evidence</h3>
                        <div className="flex flex-wrap gap-2">
                            {report.evidence.photos?.map((photo: string, idx: number) => (
                                <a key={idx} href={photo} target="_blank" rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline">
                                    Photo {idx + 1}
                                </a>
                            ))}
                            {report.evidence.audio && (
                                <a href={report.evidence.audio} target="_blank" rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline">
                                    Audio Recording
                                </a>
                            )}
                            {report.evidence.video && (
                                <a href={report.evidence.video} target="_blank" rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline">
                                    Video Recording
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {report.reporter && (
                    <div className="border-t pt-6 mb-6">
                        <h3 className="text-lg font-semibold mb-4">Reporter Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Name</p>
                                <p className="font-medium">{safeRender(report.reporter?.name)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium">{safeRender(report.reporter?.email)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Phone</p>
                                <p className="font-medium">{safeRender(report.reporter?.phone)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {report.emergencyContact && (
                    <div className="border-t pt-6 mb-6 bg-yellow-50 -m-6 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 text-yellow-900">Emergency Contact</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-yellow-700">Name</p>
                                <p className="font-medium text-yellow-900">{safeRender(report.emergencyContact?.name)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-yellow-700">Phone</p>
                                <p className="font-medium text-yellow-900">{safeRender(report.emergencyContact?.phone)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-yellow-700">Relationship</p>
                                <p className="font-medium text-yellow-900">{safeRender(report.emergencyContact?.relationship)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Update Status</h3>
                <div className="flex gap-4">
                    <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="pending">Pending</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="escalated">Escalated</option>
                        <option value="closed">Closed</option>
                    </select>
                    <button
                        onClick={handleUpdateStatus}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        Update
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Internal Notes</h3>

                <div className="mb-4">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={3}
                    />
                    <button
                        onClick={handleAddNote}
                        className="mt-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        Add Note
                    </button>
                </div>

                <div className="space-y-4">
                    {report.notes?.map((n: any, idx: number) => (
                        <div key={n.id || idx} className="border-l-4 border-purple-500 pl-4 py-2">
                            <p className="text-gray-900">{safeRender(n.note)}</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {safeRender(n.adminName)} • {formatDate(safeRender(n.createdAt))}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
