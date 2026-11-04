import assert from 'node:assert/strict';import fs from 'node:fs';import {DirectRoom,DIRECT_PROTOCOL} from '../dist/direct-room.mjs';
const hostId=crypto.randomUUID(),guestId=crypto.randomUUID(),peer={id:guestId,name:'guest',slot:0,character:0,hunterCharacter:0},host={id:hostId,name:'host',slot:1,character:1,hunterCharacter:0};let published=0;
const context={host:true,id:guestId,room:{hostId,protocol:DIRECT_PROTOCOL,phase:'lobby',players:[host,peer]},publish(){published++;},error(){throw Error('Unexpected rejection');}};
DirectRoom.prototype.command.call(context,guestId,{type:'select',slot:4,hunterCharacter:99});assert.equal(peer.slot,0);assert.equal(peer.character,0);assert.equal(published,0);
DirectRoom.prototype.command.call(context,guestId,{type:'select',slot:4,hunterCharacter:1});assert.equal(peer.slot,4);assert.equal(peer.character,null);assert.equal(peer.hunterCharacter,1);assert.equal(published,1);assert(DirectRoom.prototype.validRoster.call(context,context.room));
DirectRoom.prototype.command.call(context,guestId,{type:'select',slot:4,hunterCharacter:0});assert.equal(peer.hunterCharacter,0);assert.equal(published,2);
assert.equal(DirectRoom.prototype.descriptor({slot:4,hunterCharacter:1},guestId).hunterCharacter,1);assert.equal(DirectRoom.prototype.descriptor({slot:4,hunterCharacter:99},guestId).hunterCharacter,0);
peer.hunterCharacter=99;assert(!DirectRoom.prototype.validRoster.call(context,context.room));
const report={passed:true,version:'1.25.0',protocol:28,newHunterSelectionSynchronized:true,oldHunterStillSelectable:true,invalidSelectionDoesNotPartiallyChangeTeam:true,invalidRosterRejected:true};fs.writeFileSync(new URL('../../vr-selection-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
