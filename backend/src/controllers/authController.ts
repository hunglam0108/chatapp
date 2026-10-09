import bcrypt from "bcrypt"
import User from "../models/User.ts"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import Session from "../models/Session.ts"
import type { Request, Response } from 'express';

const ACCESS_TOKEN_TTL = '30m';
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 10000;

export const signUp = async (req: Request, res: Response) => {
    try {
        const { username, password, email, fullName } = req.body

        if (!username || !password || !email || !fullName) {
            return res
            .status(400)
            .json({message:`Please input full info user !!!`})
        }

        const duplicate = await User.findOne({ username })
        if (duplicate) {
            return res.status(400).json({ message: 'Username is esixt' }) 
        }

        const hashedPassword = await bcrypt.hash(password, 10); //salt=10

        await User.create({
            username,
            hashedPassword,
            email,
            displayName: fullName
        })

        return res.sendStatus(204)
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}

export const signIn = async (req: any, res: any) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({ message: 'Please input username and password' })
        }

        const user = await User.findOne({ username })
        if (!user) {
            return res.status(401).json({ message: 'User is not exist or wrong password' })
        }

        const correctPassword = await bcrypt.compare(password,  user.hashedPassword)
        if (!correctPassword) {
            return res.status(401).json({ message: 'User is not exist or wrong password' })
        }

        const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN || '', { expiresIn: ACCESS_TOKEN_TTL })
        const refreshToken = crypto.randomBytes(64).toString("hex")

        await Session.create({
            userId: user.id,
            refreshToken,
            expireAt: new Date(Date.now() + REFRESH_TOKEN_TTL) 
        })
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true, 
            sameSite: 'none', 
            maxAge: REFRESH_TOKEN_TTL,
        }) 

        return(res.status(200).json({ message: 'Login successfully !', accessToken }))
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}

export const signOut = async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.refreshToken;

        if (token) {
            await Session.deleteOne({ refreshToken: token })
            // Matching attributes ensure the browser actually drops the cookie.
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
            })
        }
        // res.status() alone never sends a response — use sendStatus.
        return res.sendStatus(204);
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}

export const refreshToken = async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.refreshToken;
        console.log(token)
        if(!token) {
            return res.status(401).json({ message: 'Token is not exist' })
        }

        const session = await Session.findOne({ refreshToken: token })
        if(!session) {
            return res.status(401).json({ message: 'Token is expire or invalid' })
        }

        if(session.expireAt < new Date()){
            return res.status(401).json({ message: 'Token is expire' })
        }

        const accessToken = jwt.sign({ userId: session.userId }, process.env.ACCESS_TOKEN || '', { expiresIn: ACCESS_TOKEN_TTL })
        return(res.status(200).json({ accessToken }))
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}