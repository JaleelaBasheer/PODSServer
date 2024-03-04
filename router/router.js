const express = require('express')
const userController = require('../controller/userController')
const router = new express.Router()
const multerConfig = require('../middleware/multerMiddleware')


// add file
router.post('/add',multerConfig,userController.addUser)

// create asset
router.post('/createasset',userController.createAsset)



// get user
router.get('/getall',userController.getuser)
// edit user
router.put('/edit',userController.editdata)
// get single user
router.get('/singleuser',userController.getsingleuser)
// deleterow
router.delete('/delete',userController.deleterow)

module.exports=router