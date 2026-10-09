import type { Request, Response } from 'express';

export const authMe = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        return res.status(200).json( user )
    }
    catch(err) {
        return res.status(500).json({ message: `System error !!! Error: ${err}` })
    }
}