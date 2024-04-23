const multer = require('multer')

const storage = multer.diskStorage({
    destination:(req,file,callback)=>{
        callback(null,'./uploads/uploadstags')
    },
    filename:(req,file,callback)=>{
        let filename = `${file.originalname}`
        callback(null,filename)
    }
})
const fileFilter = (req,file,callback)=>{
    if(file.mimetype === "model/fbx" || file.mimetype === "application/octet-stream"){
        callback(null,true)
    }
    else{
        callback(null,false)
        return callback(new Error("Only fbx files are allowed!!!"))
    }
}
const TagConfig = multer({
    storage,
    fileFilter
})
module.exports = TagConfig