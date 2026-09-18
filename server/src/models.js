import mongoose from 'mongoose';
const {Schema,model}=mongoose;
export const User=model('User',new Schema({email:{type:String,unique:true},password:String,role:{type:String,default:'admin'}},{timestamps:true}));
export const Category=model('Category',new Schema({name:{type:String,required:true},slug:{type:String,unique:true},image:String,description:String,subcategories:[String],order:{type:Number,default:0}},{timestamps:true}));
export const Product=model('Product',new Schema({name:{type:String,required:true},slug:{type:String,unique:true},code:String,category:String,subcategory:String,description:String,shortDescription:String,images:[String],material:String,size:String,finish:String,application:String,featured:{type:Boolean,default:false},trending:{type:Boolean,default:false},active:{type:Boolean,default:true}},{timestamps:true}));
export const Project=model('Project',new Schema({title:String,space:String,category:String,image:String,beforeImage:String,afterImage:String,description:String},{timestamps:true}));
export const Testimonial=model('Testimonial',new Schema({name:String,location:String,text:String,rating:{type:Number,default:5},active:{type:Boolean,default:true}},{timestamps:true}));
export const Setting=model('Setting',new Schema({key:{type:String,unique:true},value:Schema.Types.Mixed},{timestamps:true}));
