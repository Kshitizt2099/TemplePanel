import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import './Login.css';

type LoginStep = 'phone' | 'password';

const Login = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<LoginStep>('phone');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, ''); // Allow only digits
        if (value.length <= 10) {
            setPhone(value);
            if (value.length === 10) {
                setError('');
            } else if (isSubmitted) {
                setError('Phone number must be exactly 10 digits.');
            }
        }
    };

    const handlePhoneBlur = () => {
        if (phone.length > 0 && phone.length < 10) {
            setError('Phone number must be exactly 10 digits.');
        }
    };

    const handlePhoneSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitted(true);
        if (phone.length !== 10) {
            setError('Phone number must be exactly 10 digits.');
            return;
        }
        setError('');
        setIsSubmitted(false);
        setStep('password');
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            console.log('Sending login request for phone:', phone);
            const { data, error: supaError } = await supabase
                .from('Users')
                .select('*')
                .eq('phone_number', phone)
                .eq('password', password)
                .single();
            
            console.log('Supabase response:', { data, supaError });

            if (supaError || !data) {
                setError('Invalid phone number or password.');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Caught error during login:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setStep('phone');
        setError('');
        setPassword('');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>Temple Panel Login</h2>
                    <p>
                        {step === 'phone'
                            ? 'Please enter your phone number to sign in'
                            : `Enter password for +91 ${phone}`}
                    </p>
                </div>

                {step === 'phone' ? (
                    <form onSubmit={handlePhoneSubmit} className="login-form slide-in">
                        <div className="input-group">
                            <label htmlFor="phone">Phone Number</label>
                            <div className={`input-wrapper ${error ? 'error' : ''}`}>
                                <span className="country-code">+91</span>
                                <input
                                    id="phone"
                                    type="tel"
                                    placeholder="1234567890"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    onBlur={handlePhoneBlur}
                                    autoComplete="off"
                                />
                            </div>
                            {error && <span className="error-message">{error}</span>}
                        </div>

                        <button type="submit" className="login-button" disabled={phone.length !== 10}>
                            Continue
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordSubmit} className="login-form fade-in">
                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className={`input-wrapper ${error ? 'error' : ''}`}>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError('');
                                    }}
                                    autoFocus
                                />
                            </div>
                            {error && <span className="error-message">{error}</span>}
                        </div>

                        <button type="submit" className="login-button" disabled={!password || isLoading}>
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                        <button type="button" className="back-button" onClick={handleBack}>
                            Back to Phone Number
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
