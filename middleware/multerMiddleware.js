const multer = require('multer')

const storage = multer.diskStorage({
    destination:(req,file,callback)=>{
        callback(null,'./uploads')
    },
    filename:(req,file,callback)=>{
        let filename = `Image-${Date.now()}-${file.originalname}`
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
const multerConfig = multer({

    storage,
    fileFilter,
}).array('filesLoaded');

module.exports = multerConfig

