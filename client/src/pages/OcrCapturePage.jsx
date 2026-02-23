import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';

const OcrCapturePage = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            setError('Please upload an image file (JPG, PNG, etc.).');
            return;
        }
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
        setResult(null);
        setError(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleScan = async () => {
        if (!selectedFile) return;
        setScanning(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            const res = await api.post('/ocr/scan', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || 'OCR scan failed. Please try again.';
            setError(msg);
        } finally {
            setScanning(false);
        }
    };

    const handleUseResult = () => {
        if (!result?.parsed) return;
        // Navigate to create lesson plan page with pre-filled state
        navigate('/create-lesson', { state: { prefill: result.parsed } });
    };

    const fieldLabels = {
        title: 'Title', subject: 'Subject', grade: 'Grade',
        objectives: 'Objectives', materials: 'Materials',
        warmUp: 'Warm-Up', instruction: 'Instruction',
        guidedPractice: 'Guided Practice', independentPractice: 'Independent Practice',
        closure: 'Closure', assessment: 'Assessment',
        homework: 'Homework', notes: 'Notes'
    };

    return (
        <>
            <Header title="OCR Scan">
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                    <span className="material-icons-outlined">arrow_back</span>
                    Back
                </button>
            </Header>

            <div className="app-content">
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    {/* Hero Description */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1a73e8, #6c63ff)',
                        borderRadius: 16, padding: '28px 32px', marginBottom: 28,
                        color: '#fff', display: 'flex', gap: 20, alignItems: 'center'
                    }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14,
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <span className="material-icons-outlined" style={{ fontSize: 30 }}>document_scanner</span>
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Handwritten Lesson Plan Scanner</h2>
                            <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>
                                Upload a photo of your handwritten lesson plan and our OCR engine will digitize it instantly.
                                Review the extracted content before creating your lesson plan.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24 }}>
                        {/* Left: Upload Panel */}
                        <div>
                            <div
                                className="card"
                                style={{
                                    padding: 24, textAlign: 'center', cursor: 'pointer',
                                    border: `2px dashed ${dragOver ? '#1a73e8' : '#e5e7eb'}`,
                                    background: dragOver ? '#eff6ff' : undefined,
                                    transition: 'all 0.2s'
                                }}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => handleFile(e.target.files[0])}
                                    id="ocr-file-input"
                                />
                                {preview ? (
                                    <div>
                                        <img
                                            src={preview}
                                            alt="Preview"
                                            style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, objectFit: 'contain' }}
                                        />
                                        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280' }}>
                                            {selectedFile?.name} · Click to change
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px 0' }}>
                                        <span className="material-icons-outlined" style={{ fontSize: 56, color: '#9ca3af', marginBottom: 12, display: 'block' }}>
                                            upload_file
                                        </span>
                                        <h3 style={{ margin: '0 0 6px', color: '#374151' }}>Drop image here or click to browse</h3>
                                        <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                                            JPG, PNG, HEIC up to 10MB
                                        </p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div style={{
                                    marginTop: 12, padding: '10px 14px', borderRadius: 8,
                                    background: '#fef2f2', border: '1px solid #fecaca',
                                    color: '#dc2626', fontSize: 13, display: 'flex', gap: 8
                                }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>error</span>
                                    {error}
                                </div>
                            )}

                            {selectedFile && (
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                                    onClick={handleScan}
                                    disabled={scanning}
                                    id="scan-btn"
                                >
                                    {scanning ? (
                                        <>
                                            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                            Scanning... (this may take a moment)
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons-outlined">document_scanner</span>
                                            Scan & Extract Text
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Tips */}
                            <div className="card" style={{ marginTop: 20, padding: 16 }}>
                                <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-icons-outlined" style={{ color: '#d97706', fontSize: 18 }}>lightbulb</span>
                                    Tips for Best Results
                                </div>
                                {[
                                    'Use clear, dark ink on white/light paper',
                                    'Write in block letters for better accuracy',
                                    'Ensure good lighting, avoid shadows',
                                    'Use section headers like "Objectives:", "Materials:"',
                                    'Keep the camera still and page flat'
                                ].map((tip, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                                        <span style={{ color: '#1a73e8', fontWeight: 700 }}>{i + 1}.</span>
                                        {tip}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Results Panel */}
                        {result && (
                            <div>
                                <div className="card" style={{ padding: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h3 style={{ margin: 0 }}>Extracted Data</h3>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 12, fontSize: 11,
                                            background: '#ecfdf5', color: '#059669', fontWeight: 600
                                        }}>✓ Scan Complete</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto' }}>
                                        {Object.entries(result.parsed).map(([key, val]) => {
                                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                                            return (
                                                <div key={key}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a73e8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                                                        {fieldLabels[key] || key}
                                                    </div>
                                                    {Array.isArray(val) ? (
                                                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                                                            {val.map((item, i) => <li key={i}>{item}</li>)}
                                                        </ul>
                                                    ) : (
                                                        <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap' }}>{val}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
                                        onClick={handleUseResult}
                                        id="use-result-btn"
                                    >
                                        <span className="material-icons-outlined">arrow_forward</span>
                                        Use This Data — Create Lesson Plan
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                                        onClick={() => { setResult(null); setSelectedFile(null); setPreview(null); }}
                                    >
                                        Scan Another
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default OcrCapturePage;
