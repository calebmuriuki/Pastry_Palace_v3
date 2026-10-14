// components/NotificationPreferences.tsx
import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
    Bell,
    Smartphone,
    Mail,
    MessageCircle,
    CheckCircle2,
    Loader2,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { api, formatKenyanPhone } from "../lib/api";
import type { NotificationPreferences as NotificationPrefsType } from "../lib/api";

interface NotificationPreferencesProps {
    orderId: number;
    initialPreferences?: NotificationPrefsType;
    onUpdate?: (preferences: NotificationPrefsType) => void;
}

export const NotificationPreferences = ({
    orderId,
    initialPreferences,
    onUpdate
}: NotificationPreferencesProps) => {
    const [preferences, setPreferences] = useState<NotificationPrefsType>({
        email: true,
        sms: false,
        whatsapp: false,
        sms_consent: false,
        sms_channel: 'sms'
    });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    useEffect(() => {
        if (initialPreferences) {
            setPreferences(initialPreferences);
        }
    }, [initialPreferences]);

    const validatePhone = (phone: string): boolean => {
        try {
            formatKenyanPhone(phone);
            setPhoneError('');
            return true;
        } catch (error) {
            setPhoneError(error instanceof Error ? error.message : 'Invalid phone number');
            return false;
        }
    };

    const handleSavePreferences = async () => {
        if (preferences.sms_consent && !phoneNumber) {
            setPhoneError('Phone number required for SMS/WhatsApp updates');
            return;
        }

        if (preferences.sms_consent && phoneNumber && !validatePhone(phoneNumber)) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.updateNotificationPreferences(orderId, preferences);

            if (response.success) {
                toast.success("Notification preferences updated! 🎉", {
                    description: preferences.sms_consent
                        ? `You'll receive updates via ${preferences.sms_channel?.toUpperCase()}`
                        : "You'll receive email updates only",
                });

                if (onUpdate) onUpdate(preferences);
                setIsEditing(false);
            } else {
                throw new Error(response.message || 'Update failed');
            }
        } catch (error) {
            toast.error("Failed to update preferences", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSmsConsent = () => {
        setPreferences(prev => ({
            ...prev,
            sms_consent: !prev.sms_consent,
            sms: !prev.sms_consent,
            whatsapp: !prev.sms_consent ? prev.sms_channel === 'whatsapp' : false
        }));
    };

    const updateSmsChannel = (channel: 'sms' | 'whatsapp') => {
        setPreferences(prev => ({
            ...prev,
            sms_channel: channel,
            sms: channel === 'sms',
            whatsapp: channel === 'whatsapp'
        }));
    };

    return (
        <Card className="p-6 border-2 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-pink-500" />
                    <h2 className="text-xl font-bold text-gray-800">Notification Preferences</h2>
                </div>
                {!isEditing && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="border-pink-300 text-pink-600 hover:bg-pink-50"
                    >
                        Edit Preferences
                    </Button>
                )}
            </div>

            <Separator className="mb-4" />

            {!isEditing ? (
                // View Mode
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-700">Email Updates</span>
                        </div>
                        <span className={`text-sm font-semibold ${preferences.email ? 'text-green-600' : 'text-gray-400'}`}>
                            {preferences.email ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-gray-700">SMS Updates</span>
                        </div>
                        <span className={`text-sm font-semibold ${preferences.sms ? 'text-green-600' : 'text-gray-400'}`}>
                            {preferences.sms ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-700">WhatsApp Updates</span>
                        </div>
                        <span className={`text-sm font-semibold ${preferences.whatsapp ? 'text-green-600' : 'text-gray-400'}`}>
                            {preferences.whatsapp ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>

                    {preferences.sms_consent && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-blue-700 text-center">
                                ✓ You'll receive real-time updates on your order status
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                // Edit Mode
                <div className="space-y-5">
                    {/* Email Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <div>
                                <p className="font-semibold text-gray-700">Email Updates</p>
                                <p className="text-xs text-gray-500">Order confirmations and receipts</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.email}
                                onChange={(e) => setPreferences(prev => ({ ...prev, email: e.target.checked }))}
                                className="sr-only peer"
                                disabled={isLoading}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                        </label>
                    </div>

                    {/* SMS Consent Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-green-500" />
                            <div>
                                <p className="font-semibold text-gray-700">SMS/WhatsApp Updates</p>
                                <p className="text-xs text-gray-500">Real-time order status notifications</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences.sms_consent}
                                onChange={toggleSmsConsent}
                                className="sr-only peer"
                                disabled={isLoading}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>

                    {/* Phone Number Input */}
                    {preferences.sms_consent && (
                        <div className="ml-7 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <Input
                                    type="tel"
                                    placeholder="0722 123456 or 254722123456"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value);
                                        if (phoneError) validatePhone(e.target.value);
                                    }}
                                    onBlur={() => validatePhone(phoneNumber)}
                                    disabled={isLoading}
                                    className={phoneError ? 'border-red-500 focus:ring-red-500' : ''}
                                />
                                {phoneError && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {phoneError}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Required for SMS/WhatsApp notifications
                                </p>
                            </div>

                            {/* Channel Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Preferred Channel
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => updateSmsChannel('sms')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${preferences.sms_channel === 'sms'
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        disabled={isLoading}
                                    >
                                        <Smartphone className="w-5 h-5 mx-auto mb-1" />
                                        <span className="text-sm font-medium">SMS</span>
                                        <p className="text-xs text-gray-500 mt-1">Standard text messages</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateSmsChannel('whatsapp')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${preferences.sms_channel === 'whatsapp'
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        disabled={isLoading}
                                    >
                                        <MessageCircle className="w-5 h-5 mx-auto mb-1" />
                                        <span className="text-sm font-medium">WhatsApp</span>
                                        <p className="text-xs text-gray-500 mt-1">Rich media + tracking</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleSavePreferences}
                            disabled={isLoading}
                            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Save Preferences
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditing(false);
                                setPhoneError('');
                            }}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default NotificationPreferences;