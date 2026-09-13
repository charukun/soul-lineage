import {THREE} from '@soul/rendering';
import {createMuraModels} from '@soul/rendering/mura';
const models=createMuraModels(THREE,{createCanvas:()=>document.createElement('canvas')});
export const {mat,prop,person,interiorShell,building,floorFor,sailingShip,animal}=models;
