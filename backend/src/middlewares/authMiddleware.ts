import jwt from "jsonwebtoken"
import User from "../models/User.ts"
import type { Request, Response } from 'express';
import { decode } from "node:punycode";
import type { UserJwtPayload } from "../types/userJwtPayload.ts";

export const protectedRoute = (req: Request, res: Response, next: Function) => {
    try {
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Accesstoken not found' });
        }

        jwt.verify(token, process.env.ACCESS_TOKEN || '', async (err, decoderUser) => {
            if(err || !decoderUser) {
                return res.status(403).json({ message: 'Accesstoken is invalid or expired' });
            }

            const userId = (decoderUser as UserJwtPayload).userId;
            const user = await User.findById(userId).select('-hashedPassword');

            if(!user) {
                return res.status(404).json({ message: 'User not found '})
            }

            (req as any).user = user;
            
            next()
        })
    }
    catch(err) {
        console.log('Error Auth JWT', err);
        return res.status(500).json({ message: 'System Error', err });
    }
}   