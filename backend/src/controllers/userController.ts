import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.ts';
import Session from '../models/Session.ts';
import { deleteCloudinaryFiles, isUploadedAttachmentUrl } from '../utils/cloudinary.ts';

const MAX_DISPLAY_NAME = 50;

/** PATCH /api/user/me { displayName } */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
        if (!displayName || displayName.length > MAX_DISPLAY_NAME) {
            return res.status(400).json({ message: `Display name must be 1-${MAX_DISPLAY_NAME} characters` });
        }

        const user = await User.findByIdAndUpdate(
            (req as any).user._id,
            { displayName },
            { returnDocument: 'after' }
        ).select('-hashedPassword');

        return res.status(200).json(user);
    }
    catch(err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

/** PATCH /api/user/me/password { currentPassword, newPassword } */
export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body ?? {};
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({ message: 'Please enter your current password' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }

        // protectedRoute bỏ hashedPassword nên phải load lại.
        const user = await User.findById((req as any).user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 400 thay vì 401/403: 403 sẽ kích hoạt flow refresh token ở client.
        if (!(await bcrypt.compare(currentPassword, user.hashedPassword))) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        if (await bcrypt.compare(newPassword, user.hashedPassword)) {
            return res.status(400).json({ message: 'New password must be different from the current one' });
        }

        user.hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Đăng xuất các thiết bị khác, giữ session hiện tại.
        await Session.deleteMany({
            userId: user._id,
            refreshToken: { $ne: req.cookies?.refreshToken },
        });

        return res.status(200).json({ message: 'Password updated' });
    }
    catch(err) {
        console.error('Error changing password:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

/** PATCH /api/user/me/avatar { avatarUrl } — URL lấy từ POST /api/upload/file. */
export const updateAvatar = async (req: Request, res: Response) => {
    try {
        const { avatarUrl } = req.body ?? {};
        if (!isUploadedAttachmentUrl(avatarUrl) || !avatarUrl.includes('/image/upload/')) {
            return res.status(400).json({ message: 'Invalid avatar image' });
        }

        const current = (req as any).user;
        const oldAvatarUrl = current.avatarUrl;
        const user = await User.findByIdAndUpdate(
            current._id,
            { avatarUrl },
            { returnDocument: 'after' }
        ).select('-hashedPassword');

        if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
            void deleteCloudinaryFiles([oldAvatarUrl]);
        }

        return res.status(200).json(user);
    }
    catch(err) {
        console.error('Error updating avatar:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export const authMe = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        return res.status(200).json( user )
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}