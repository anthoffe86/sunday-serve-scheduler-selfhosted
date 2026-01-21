import { Shield, Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings";
import { Navigate } from "react-router-dom";

const AdminSettings = () => {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const { data: settings, isLoading: settingsLoading } = useSystemSettings();
    const updateSetting = useUpdateSystemSetting();

    if (authLoading || settingsLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    const getSettingValue = (key: string) => {
        const setting = settings?.find(s => s.key === key);
        // Parse value since it's stored as JSONB
        try {
            return typeof setting?.value === 'string' ? JSON.parse(setting.value) : setting?.value;
        } catch {
            return setting?.value;
        }
    };

    const handleToggle = (key: string, currentValue: boolean) => {
        updateSetting.mutate({ key, value: !currentValue });
    };

    const emailSettings = [
        {
            key: 'email_on_invite',
            label: 'New Invite Emails',
            description: 'Send an email when a new volunteer is invited to the system.'
        },
        {
            key: 'email_on_invitation_send',
            label: 'Schedule Invitation Emails',
            description: 'Send invitation emails when "Send Invitations" is clicked, asking volunteers to accept or decline.'
        },
        {
            key: 'email_on_publish',
            label: 'Event Publication Emails',
            description: 'Send confirmation emails to volunteers when events are published/locked.'
        },
        {
            key: 'email_on_swap_request',
            label: 'Swap Notification Emails',
            description: 'Send emails to eligible substitutes when a swap is requested.'
        },
        {
            key: 'email_on_assignment_remove',
            label: 'Assignment Removal Emails',
            description: 'Send an email to a volunteer when they are removed from an event.'
        }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold">Admin Settings</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Configure system-wide settings and email notifications</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-serif">
                        <Mail className="h-5 w-5 text-primary" />
                        Email Notifications
                    </CardTitle>
                    <CardDescription>
                        Toggle which automated emails are sent by the system.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {emailSettings.map((setting) => {
                        const isEnabled = !!getSettingValue(setting.key);
                        return (
                            <div key={setting.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                <div className="flex flex-col space-y-1 flex-1">
                                    <Label htmlFor={setting.key} className="font-medium text-sm sm:text-base">
                                        {setting.label}
                                    </Label>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        {setting.description}
                                    </p>
                                </div>
                                <Switch
                                    id={setting.key}
                                    checked={isEnabled}
                                    onCheckedChange={() => handleToggle(setting.key, isEnabled)}
                                    disabled={updateSetting.isPending}
                                    className="self-start sm:self-auto"
                                />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <div className="rounded-lg bg-blue-50 p-3 sm:p-4 border border-blue-100 flex gap-2 sm:gap-3">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-blue-800">
                    <p className="font-semibold mb-1">Note for Admins</p>
                    <p>These settings affect all users. Disabling "Event Publication Emails" will prevent volunteers from receiving their schedules automatically when you hit publish.</p>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
