import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './Dashboard.css';

type ContentRecord = {
    id: number;
    created_at: string;
    tyepOfContent: string;
    content: string;
    Position: string | null;
};

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'records'>('upload');

    // --- Upload State ---
    const [file, setFile] = useState<File | null>(null);
    const [typeOfContent, setTypeOfContent] = useState('image');
    const [position, setPosition] = useState('');
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    // --- Records State ---
    const [records, setRecords] = useState<ContentRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);

    // Fetch records when the 'records' tab is clicked
    useEffect(() => {
        if (activeTab === 'records') {
            fetchRecords();
        }
    }, [activeTab]);

    const fetchRecords = async () => {
        setLoadingRecords(true);
        const { data, error } = await supabase
            .from('Contents')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching records:', error);
        } else {
            setRecords(data || []);
        }
        setLoadingRecords(false);
    };

    const handleDelete = async (record: ContentRecord) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this content? This cannot be undone.");
        if (!confirmDelete) return;
        
        try {
            // Extract the filename from the full URL
            const urlParts = record.content.split('/TempleContents/');
            
            if (urlParts.length > 1) {
                const filePath = urlParts[1];
                
                // 1. Delete from Supabase Storage
                const { error: storageError } = await supabase.storage
                    .from('TempleContents')
                    .remove([filePath]);
                    
                if (storageError) {
                    console.error("Storage delete error:", storageError);
                    throw storageError;
                }
            }

            // 2. Delete from Database
            const { error: dbError } = await supabase
                .from('Contents')
                .delete()
                .eq('id', record.id);
                
            if (dbError) {
                throw dbError;
            }
            
            // Remove from local screen immediately
            setRecords(prev => prev.filter(r => r.id !== record.id));
            
        } catch (error: any) {
            console.error("Error deleting record:", error);
            alert("Failed to delete: " + error.message);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const clearHomepagePosition = async () => {
        const { error } = await supabase
            .from('Contents')
            .update({ Position: null })
            .eq('Position', 'homepage');
        if (error) throw error;
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!file) {
            setMessage('Please select a file to upload.');
            return;
        }

        try {
            setUploading(true);
            setMessage('Uploading file to storage...');

            const filePath = file.name.replace(/\s+/g, '-');

            const { error: uploadError } = await supabase.storage
                .from('TempleContents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                throw uploadError;
            }

            setMessage('File uploaded! Saving URL to database...');

            const { data: publicUrlData } = supabase.storage
                .from('TempleContents')
                .getPublicUrl(filePath);

            const publicUrl = publicUrlData.publicUrl;

            // If assigning homepage, first clear any existing homepage video
            if (typeOfContent === 'video' && position === 'homepage') {
                setMessage('Clearing existing homepage video...');
                await clearHomepagePosition();
            }

            const { error: dbError } = await supabase
                .from('Contents') 
                .insert([
                    { 
                        tyepOfContent: typeOfContent, 
                        content: publicUrl,
                        Position: typeOfContent === 'video' ? (position || null) : null 
                    }
                ]);

            if (dbError) {
                throw dbError;
            }

            setMessage('Upload complete! 🎉');
            setFile(null);
            setPosition('');
            
            const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

        } catch (error: any) {
            console.error('Error uploading:', error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleSetHomepage = async (record: ContentRecord) => {
        try {
            // Remove homepage from any existing video
            await clearHomepagePosition();
            // Assign homepage to this record
            const { error } = await supabase
                .from('Contents')
                .update({ Position: 'homepage' })
                .eq('id', record.id);
            if (error) throw error;
            setRecords(prev =>
                prev.map(r =>
                    r.tyepOfContent === 'video'
                        ? { ...r, Position: r.id === record.id ? 'homepage' : null }
                        : r
                )
            );
        } catch (error: any) {
            alert('Failed to set homepage: ' + error.message);
        }
    };

    const handleRemoveHomepage = async (record: ContentRecord) => {
        try {
            const { error } = await supabase
                .from('Contents')
                .update({ Position: null })
                .eq('id', record.id);
            if (error) throw error;
            setRecords(prev =>
                prev.map(r =>
                    r.id === record.id ? { ...r, Position: null } : r
                )
            );
        } catch (error: any) {
            alert('Failed to remove homepage: ' + error.message);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                
                {/* TABS NAVIGATION */}
                <div className="tabs">
                    <button 
                        className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upload')}
                    >
                        Upload Content
                    </button>
                    <button 
                        className={`tab ${activeTab === 'records' ? 'active' : ''}`}
                        onClick={() => setActiveTab('records')}
                    >
                        View Records
                    </button>
                </div>

                <div className="tab-content">
                    
                    {/* UPLOAD TAB CONTENT */}
                    {activeTab === 'upload' && (
                        <div className="upload-section fade-in">
                            <h2>Upload New Content</h2>
                            <form onSubmit={handleUpload} className="upload-form">
                                
                                <div className="input-group">
                                    <label htmlFor="contentType">Content Type</label>
                                    <select 
                                        id="contentType" 
                                        value={typeOfContent} 
                                        onChange={(e) => setTypeOfContent(e.target.value)}
                                        className="styled-input"
                                    >
                                        <option value="image">Image</option>
                                        <option value="video">Video</option>
                                    </select>
                                </div>

                                {typeOfContent === 'video' && (
                                    <div className="input-group">
                                        <label htmlFor="position">Position (Optional)</label>
                                        <select
                                            id="position"
                                            value={position}
                                            onChange={(e) => setPosition(e.target.value)}
                                            className="styled-input"
                                        >
                                            <option value="">-- No Position --</option>
                                            <option value="homepage">Homepage</option>
                                        </select>
                                    </div>
                                )}

                                <div className="input-group">
                                    <label htmlFor="fileUpload">Select File</label>
                                    <input 
                                        id="fileUpload"
                                        type="file" 
                                        accept="image/*,video/*"
                                        onChange={handleFileChange}
                                        className="styled-input file-input"
                                    />
                                </div>

                                <button type="submit" className="upload-button" disabled={!file || uploading}>
                                    {uploading ? 'Processing...' : 'Upload to Supabase'}
                                </button>

                                {message && (
                                    <p className={`message ${message.includes('Error') ? 'error-text' : 'success-text'}`}>
                                        {message}
                                    </p>
                                )}
                            </form>
                        </div>
                    )}

                    {/* RECORDS TAB CONTENT */}
                    {activeTab === 'records' && (
                        <div className="records-section fade-in">
                            <h2>Content Records</h2>
                            
                            {loadingRecords ? (
                                <p className="loading-text">Loading records from Supabase...</p>
                            ) : records.length === 0 ? (
                                <p className="empty-text">No content found. Start uploading!</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="records-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Type</th>
                                                <th>Position</th>
                                                <th>Preview</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map(record => (
                                                <tr key={record.id}>
                                                    <td>{record.id}</td>
                                                    <td>
                                                        <span className={`badge ${record.tyepOfContent}`}>
                                                            {record.tyepOfContent}
                                                        </span>
                                                    </td>
                                                    <td>{record.Position || '-'}</td>
                                                    <td>
                                                        {record.tyepOfContent === 'image' ? (
                                                            <img src={record.content} alt="Preview" className="table-preview" />
                                                        ) : (
                                                            <video src={record.content} className="table-preview" muted />
                                                        )}
                                                        <br />
                                                        <a href={record.content} target="_blank" rel="noopener noreferrer" className="link">View Full Size</a>
                                                    </td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            {record.tyepOfContent === 'video' && (
                                                                record.Position === 'homepage' ? (
                                                                    <button
                                                                        className="homepage-button remove"
                                                                        onClick={() => handleRemoveHomepage(record)}
                                                                    >
                                                                        ✕ Remove Homepage
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className="homepage-button set"
                                                                        onClick={() => handleSetHomepage(record)}
                                                                    >
                                                                        🏠 Set as Homepage
                                                                    </button>
                                                                )
                                                            )}
                                                            <button 
                                                                className="delete-button" 
                                                                onClick={() => handleDelete(record)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Dashboard;
