import espress from "express";
import logger from 'morgan';
import dotenv from 'dotenv'
import { Server } from "socket.io";
import { createServer } from 'node:http'
import { createClient } from "@libsql/client";

dotenv.config()

// Puerto
const port = process.env.PORT ?? 3000
// Instancia
const app = espress()
const server = createServer(app)

// conexion db
const db = createClient({
    url: process.env.DB_URL,
    authToken: process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
`)

const io = new Server(server,{
    connectionStateRecovery:{}
})

io.on('connection',async(socket)=>{

    console.log('a user has connected!')
 
    socket.on('disconnect',()=>{
        console.log('a user has disconnected!')
    })
 
    socket.on('chat message',async(msg)=>{
        let result
        const username = socket.handshake.auth.username ?? 'anonymous'
        console.log({ username })

        try {

            result = await db.execute({
                sql: `INSERT INTO messages (content,user) VALUES (:msg, :username)`,
                args: { msg ,username}
            })
        
        } catch (e) {
            console.log(e)
            return
        }
        // emite un mensaje 
        io.emit('chat message',msg, result.lastInsertRowid.toString(),username)
    })

    if(!socket.recovered){
        try {
            const results = await db.execute({
                sql:'SELECT id, content,user FROM messages WHERE id > ?',
                args:[socket.handshake.auth.serverOffset ?? 0]
            })
            results.rows.forEach( row =>{
                socket.emit('chat message', row.content, row.id.toString(),row.user)
            })
        } catch (error) {
            console.log(error)
        }
    }

})


app.use(logger('dev')) 

app.get('/',(req,res)=>{
    // process.cwd() desde donde se ejecuta (la ruta)
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port,()=>{
    console.log(`Server running in port ${port}`)
})