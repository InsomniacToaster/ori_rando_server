import React from 'react';
import './index.css';
import './bootstrap.cyborg.min.css';
//import registerServiceWorker from './registerServiceWorker';
import { Map, Tooltip, TileLayer, Marker} from 'react-leaflet';
import {Checkbox, CheckboxGroup} from 'react-checkbox-group';
import {Radio, RadioGroup} from 'react-radio-group';
import Leaflet from 'leaflet';
import {distance, picks_by_type, PickupMarkersList, pickup_icons, getMapCrs, presets} from './shared_map.js';
import Select from 'react-select';
import 'react-select/dist/react-select.css';

const paths = Object.keys(presets);
const game_id = document.getElementsByClassName("game-id-holder")[0].id;

const EMPTY_PLAYER = {seed: {}, pos: [0,0], seen:[], flags: ["show_marker"], areas: [], mapstones: {pos: [0,0], turnedIn: 0, picks: [], seen: [], foundAt: {}}}

function parse_seed(raw) {
	let out = {}
	let msout = []
	let lines = raw.split("\n")
    for (let i = 0, len = lines.length; i < len; i++) {
    	let line = lines[i].split(":")
    	out[parseInt(line[0])] = line[1]
	}
    for (let i = 24; i < 60; i+=4) {
    	if(out.hasOwnProperty(i))
			msout.push(out[i])
	}
	return {seed: out, ms: msout}
 }

function player_icons(id)  {
	id = parseInt(id);
	let img = 	'../sprites/ori-white.png';
	if (id === 1)  img = '../sprites/ori-blue.png';
	else if (id === 2)  img = '../sprites/ori-red.png';
	else if (id === 3)  img = '../sprites/ori-green.png';
	else if (id === 4)  img = '../sprites/ori-purple.png';
	else if (id === 5)  img = '../sprites/ori-yellow.png';
	else if (id === 6)  img = '../sprites/ori-white.png';
	else if (id === 200)  img = '../sprites/ori-skul.png';
	let ico = new Leaflet.Icon({iconUrl: img, iconSize: new Leaflet.Point(48, 48)});
	return ico
};

function get_inner(id) {
	return (
	<Tooltip>
	<span>{id}</span>	
	</Tooltip>
	);
}

const PlayerMarker = ({ map, position, icon, inner}) => ( 
	<Marker map={map} position={position} icon={icon}>
		{inner}
	</Marker>
	);
const PlayerMarkersList = ({map, players}) => {
	let players_to_show = [];
	Object.keys(players).map((id) => {
		if(players[id].flags.includes("show_marker"))
			players_to_show.push(id)
	});
	const items = players_to_show.map((id) => (
		<PlayerMarker  key={"player_"+id} map={map} position={players[id].pos} inner={get_inner(id)} icon={player_icons(id)}  /> 
	));
	return (<div style={{display: 'none'}}>{items}</div>);
}

const PlayerUiOpts = ({players, setter}) => {
	if(!players || Object.keys(players).length === 0)
		return null;
	const items = Object.keys(players).map((id) => {
		let f = (newFlags) => setter((prevState) => {
			let retVal = prevState.players;
			retVal[id].flags = newFlags;
			return {players:retVal};
		});
		return (		
			<tr><td><table style={{width: "100%"}}><tbody>
			<tr><td><h6>Player {id}</h6></td></tr>
				<CheckboxGroup checkboxDepth={4} name={id+"_flags"} value={players[id].flags} onChange={f}>
				<tr>
					<td><label><Checkbox value="show_marker"/> Show on map</label></td>
					<td><label><Checkbox value="show_spoiler"/> Show spoilers</label></td>
					<td><label><Checkbox value="hide_found"/> Hide found</label></td>
				</tr>
				<tr>
					<td><label><Checkbox value="hide_unreachable"/> Hide unreachable</label></td>
					<td><label><Checkbox value="hide_remaining"/> Hide remaining</label></td>
					<td><label><Checkbox value="hide_reachable"/> Hide reachable</label></td>
				</tr>
		       </CheckboxGroup>
	       </tbody></table></td></tr>
		);
	});
	return (<table style={{width: "100%"}}><tbody>{items}</tbody></table>);
}




function getLocInfo(pick, players) {
	let loc = pick.loc;
	let isMs = (pick.name === "MapStone")

	let info = Object.keys(players).map((id) => {
		let show_spoiler = players[id].flags.includes("show_spoiler");
		let mapstones =  players[id].mapstones
		let seen = players[id].seen.includes(loc) || mapstones.seen.includes(pick.loc);
		if(isMs) {
			if(seen)
				return id + ":" + mapstones.foundAt[pick.loc] + (show_spoiler ? "*" : "");
			else if(show_spoiler)
				return id + ":" + mapstones.picks[mapstones.turnedIn];
			else
				return id + ":" + "(hidden)";
			
		}	else {
			if(show_spoiler || seen)
				return id + ":" + players[id].seed[loc] + (show_spoiler && seen ? "*" : "");
			else
				return id + ":" + "(hidden)"			
		}	
	});
	return info;
}

function getPickupMarkers(state) {
	let players = state.players;
	let hideOpt = state.hideOpt;
	let pickupTypes = state.pickups;
	let markers = []
	for(let i in pickupTypes) {
		let pre = pickupTypes[i];
		for(let p in picks_by_type[pre]) {
			let pick = picks_by_type[pre][p]
			let count = Object.keys(players).length
			let x = pick.hasOwnProperty("_x") ? pick._x : pick.x
			let y = pick.hasOwnProperty("_y") ? pick._y : pick.y
			let icon = pick.hasOwnProperty("icon") ? pick.icon : pickup_icons[pre]
			if(count === 0) {
				markers.push({key: pick.name+"|"+pick.x+","+pick.y, position: [y, x], inner: null, icon: icon})
				continue				
			}
			Object.keys(players).map((id) => {
				let player = players[id]
				let hide_found = player.flags.includes("hide_found")
				let hide_unreachable = player.flags.includes("hide_unreachable")
				let hide_remaining = player.flags.includes("hide_remaining")
				let hide_reachable = player.flags.includes("hide_reachable")

				let found = player.seen.includes(pick.loc) || player.mapstones.seen.includes(pick.loc)
				
				let reachable = players[id].areas.includes(pick.area)

				if( (found && hide_found) || (!found && hide_remaining) || (reachable && hide_reachable) || (!reachable && hide_unreachable && !found))
					count -= 1;
			});
			
			
			if((hideOpt === "any") ? (count === Object.keys(players).length) : (count > 0))
			{
				let loc_info = getLocInfo(pick, players);
				let inner = null;
				if(loc_info)
				{
				let lines = loc_info.map((infoln) => {
					return (
					<tr><td style={{color:'black'}}>{infoln}</td></tr>
					)
				});
				inner = (
				<Tooltip>
					<table>
					{lines}
					</table>
				</Tooltip>
				);					
				}
				markers.push({key: pick.name+"|"+pick.x+","+pick.y, position: [y, x], inner: inner, icon: icon});								
			}
	
		}
	}
	return markers
};

// Work-around for lines between tiles on fractional zoom levels
// https://github.com/Leaflet/Leaflet/issues/3575
(function(){
    var originalInitTile = Leaflet.GridLayer.prototype._initTile
    Leaflet.GridLayer.include({
        _initTile: function (tile) {
            originalInitTile.call(this, tile);

            var tileSize = this.getTileSize();

            tile.style.width = tileSize.x + 1 + 'px';
            tile.style.height = tileSize.y + 1 + 'px';
        }
    });
})()

const DEFAULT_VIEWPORT = {
	  center: [0, 0],
	  zoom: 3,
	}
const crs = getMapCrs();

class GameTracker extends React.Component {
  constructor(props) {
    super(props)
    let modeRaw = document.getElementsByClassName("logic-modes-holder")[0].id
    let modes = (modeRaw !== "None") ? modeRaw.split(" ") : ['normal', 'speed', 'dboost-light', 'lure']

    this.state = {players: {}, done: false, check_seen: 1, modes: modes, 
    flags: ['show_pickups', 'update_in_bg'], viewport: DEFAULT_VIEWPORT, pickups: ["EX", "HC", "SK", "Pl", "KS", "MS", "EC", "AC", "EV", "Ma"], 
    pathMode: 'standard', hideOpt: "any"}
  };
  componentDidMount() {
	  this.interval = setInterval(() => this.tick(), 1000);
  };
  
  tick = () => {
  	if((!document.hasFocus() && !this.state.flags.includes("update_in_bg") )|| this.state.done) return;
  	if(this.state.check_seen == 0) {
	  	this.setState({check_seen: 5});
		getSeen((p) => this.setState(p, this.checkMapstones()));
		getReachable((p) => this.setState(p),this.state.modes.join("+"));
  	} else 
	  	this.setState({check_seen: this.state.check_seen -1});
	if(this.state.check_seen < 10)
		getPlayerPos((p) => this.setState(p));

	Object.keys(this.state.players).map((id) => {
		if(Object.keys(this.state.players[id].seed).length === 0)
			getSeed((p) => this.setState(p), id);
	})
  };
  
  checkMapstones = () => {
	this.setState((prevState, props) => {
		let newPlayers = this.state.players;
	  	Object.keys(newPlayers).map((id) => {
	  		let player = {...newPlayers[id]}
	  		let mapstones = player.mapstones
	  		let nextMapstoneId = mapstones.turnedIn*4+24;
	  		if(player.seen.includes(nextMapstoneId)) {
	  			let min_dist = 99999;
		  		let pos = mapstones.pos;
	  			let closest_ms = null;
	  			picks_by_type["Ma"].forEach((msPick) => {
	  				if(!mapstones.seen.includes(msPick.loc))
	  				{	  					
		  				let dist = distance(pos[1], pos[0], msPick.x, msPick.y);
		  				if(dist < min_dist) {
		  					min_dist = dist;
		  					closest_ms = msPick;
		  				}
	  				}
	  			});
				if(closest_ms) {
					mapstones.seen.push(closest_ms.loc)
					mapstones.foundAt[closest_ms.loc] = mapstones.picks[mapstones.turnedIn]
					mapstones.turnedIn += 1
				}
			}
			mapstones.pos = player.pos;
			newPlayers[id] = player
	  	});
	  	return {players: newPlayers};
  	})
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }
  
  
  hideOptChanged = (newVal) => { this.setState({hideOpt: newVal}) }
  flagsChanged = (newVal) => { this.setState({flags: newVal}) }
  pickupsChanged = (newVal) => { this.setState({pickups: newVal}) }
  modesChanged = (newVal) => this.setState({modes: newVal}, () => getReachable((p) => this.setState(p),this.state.modes.join("+")))
  
  onViewportChanged = viewport => { this.setState({ viewport }) }
 _onPathModeChange = (n) => paths.includes(n.value) ? this.setState({modes: presets[n.value], pathMode: n.value}, () => getReachable((p) => this.setState(p),this.state.modes.join("+"))) : this.setState({pathMode: n.value})


    render() {
	const pickup_markers = this.state.flags.includes('show_pickups') ? ( <PickupMarkersList markers={getPickupMarkers(this.state)} />) : null
	const player_markers =  ( <PlayerMarkersList players={this.state.players} />) 
	const player_opts = ( <PlayerUiOpts players={this.state.players} setter={(p) => this.setState(p)} />)
    return (
        <table style={{ width: '100%' }}><tbody>
        <tr><td style={{ width: 'available' }}>
             <Map crs={crs} onViewportChanged={this.onViewportChanged} viewport={this.state.viewport}>
				<TileLayer url=' https://ori-tracker.firebaseapp.com/images/ori-map/{z}/{x}/{y}.png' noWrap='true'  />
				{pickup_markers}
				{player_markers}
		     </Map>
		</td>
		<td style={{ width: '360px'}}>
			<table style={{ width: '100%'}}><tbody>
		        <tr><td><button  onClick={ () => this.setState({ viewport: DEFAULT_VIEWPORT }) } >
		          Reset View
		        </button></td></tr>

				<tr><td><h5>Flags</h5></td></tr>
				<tr><CheckboxGroup checkboxDepth={3} name="flags" value={this.state.flags} onChange={this.flagsChanged}> 
			        <td><label><Checkbox value="show_pickups"/> Pickups</label></td>
			        <td><label><Checkbox value="update_in_bg"/> Always Update</label></td>
		       </CheckboxGroup></tr>
		       
				<tr><td><h5>Players</h5></td></tr>		
				{player_opts}

				<tr><td><span>Hide pickup if it would be hidden for...</span></td></tr>
				<tr><RadioGroup name="hideOpts" selectedValue={this.state.hideOpt} onChange={this.hideOptChanged}> 
			        <td><label><Radio value="all"/> ...all players</label></td>
			        <td><label><Radio value="any"/> ...any player</label></td>
		       </RadioGroup ></tr>

		       	<tr style={{width: '100%'}}><td>
		       		<table style={{width: '100%'}}><tbody>
		       			<tr><td style={{width: '120px'}}>
		       				<label>Logic Presets:</label>
		       			</td><td>
		       				<Select options={paths.map((n) => {return {label: n, value: n}})} onChange={this._onPathModeChange} clearable={false} value={this.state.pathMode} label={this.state.pathMode}></Select>
		       			</td></tr>
		       		</tbody></table>
		       	</td></tr>
				<tr style={{width: '100%'}}><td>
					<table style={{width: '100%'}}><tbody>
						<CheckboxGroup checkboxDepth={4} name="modes" value={this.state.modes} onChange={this.modesChanged}> 
							<tr style={{width: '100%'}}>
								<td><label><Checkbox value="normal" /> normal</label></td>
								<td><label><Checkbox value="speed" /> speed</label></td>
								<td><label><Checkbox value="extended" /> extended</label></td>
							</tr>
							<tr style={{width: '100%'}}>
								<td><label><Checkbox value="speed-lure" /> speed-lure</label></td>
								<td><label><Checkbox value="lure" /> lure</label></td>
								<td><label><Checkbox value="lure-hard" /> lure-hard</label></td>
							</tr>
							<tr style={{width: '100%'}}>
								<td><label><Checkbox value="dboost-light" /> dboost-light</label></td>
								<td><label><Checkbox value="dboost" /> dboost</label></td>
								<td><label><Checkbox value="dboost-hard" /> dboost-hard</label></td>
							</tr>
							<tr style={{width: '100%'}}>		
								<td><label><Checkbox value="cdash" /> cdash</label></td>
								<td><label><Checkbox value="cdash-farming" /> cdash-farming</label></td>
								<td><label><Checkbox value="extreme" /> extreme</label></td>
							</tr>
							<tr style={{width: '100%'}}>		
								<td><label><Checkbox value="extended-damage" /> extended-damage</label></td>
								<td><label><Checkbox value="timed-level" /> timed-level</label></td>
							</tr>
							<tr style={{width: '100%'}}>		
								<td><label><Checkbox value="dbash" /> dbash</label></td>
								<td><label><Checkbox value="glitched" /> glitched</label></td>
							</tr>
				       </CheckboxGroup>
					</tbody></table>
				</td></tr>


				<tr><td><h5>Visible Pickups</h5></td></tr>				       
				<CheckboxGroup checkboxDepth={4} name="options" value={this.state.pickups} onChange={this.pickupsChanged}> 
					<tr>
						<td><label><Checkbox value="SK" />Skill trees</label></td>
						<td><label><Checkbox value="MS" />Mapstones</label></td>
						<td><label><Checkbox value="EV" />Events</label></td>
					</tr>
					<tr>
						<td><label><Checkbox value="AC" />Abiliy Cells</label></td>
						<td><label><Checkbox value="HC" />Health Cells</label></td>
						<td><label><Checkbox value="EC" />Energy Cells</label></td>
					</tr>
					<tr>
						<td><label><Checkbox value="Pl" />Plants</label></td>
						<td><label><Checkbox value="KS" />Keystones</label></td>
						<td><label><Checkbox value="EX" />Exp Orbs</label></td>	
					</tr>
					<tr>
						<td><label><Checkbox value="Ma" />Mapstone turnins</label></td>
					</tr>
		       </CheckboxGroup>
	       </tbody></table>
	 </td></tr>
     </tbody></table>
	)
  }
}

function getSeed(setter, pid)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
            (function(res) {
				setter((prevState, props) => {
					let retVal = prevState.players;
					let out = parse_seed(res);
					retVal[pid].seed = out.seed
					retVal[pid].mapstones.picks = out.ms 
					return {players:retVal}
				});

            })(xmlHttp.responseText);
    }
    xmlHttp.open("GET", "/"+game_id+"."+pid+"/seed", true); // true for asynchronous 
    xmlHttp.send(null);
}

function getReachable(setter, modes)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
            (function(res) {
            	if(res == "Stop")
            	{
            		setter({check_seen: 90});
					return;
            	}
            	let areas = {};
            	let raw = res.split("|");
            	for (let i = 0, len = raw.length; i < len; i++) {
            		let withid = raw[i].split(":");
            		if(withid[1] == "") 
            			continue;
            		let id = withid[0];
					areas[id] = withid[1].split(",");
				}
				setter((prevState, props) => {
					let retVal = prevState.players
					Object.keys(areas).map((id) => {
						if(!retVal.hasOwnProperty(id)){
							retVal[id] = {...EMPTY_PLAYER};
						}
						retVal[id].areas = areas[id]
					})
					return {players:retVal}
				})
            })(xmlHttp.responseText);
    }
    xmlHttp.open("GET", "/"+game_id+"/reachable?modes="+modes, true); // true for asynchronous 
    xmlHttp.send(null);
}

function getSeen(setter)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
            (function(res) {
            	if(res == "Stop")
            	{
            		setter({check_seen: 90});
					return;
            	}
            	if(!res.includes(':')) {
            		setter({check_seen: 60})
            		return;
            	}
            	let seens = {};
            	let raw = res.split("|");
            	for (let i = 0, len = raw.length; i < len; i++) {
            		let withid = raw[i].split(":");
            		if(withid[1] == "") 
            			continue;
            		let id = withid[0];
					seens[id] = withid[1].split(",").map((i) => parseInt(i));
				}
				setter((prevState, props) => {
					let retVal = prevState.players
					Object.keys(seens).map((id) => {
						if(!retVal.hasOwnProperty(id)){
							retVal[id] = {...EMPTY_PLAYER};
						}
						retVal[id].seen = seens[id]
					})
					return {players:retVal}
				})
            })(xmlHttp.responseText);
    }
    xmlHttp.open("GET", "/"+game_id+"/seen", true); // true for asynchronous 
    xmlHttp.send(null);
}


function getPlayerPos(setter)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
            (function(res) {
            	if(res == "Stop")
            	{
            		setter({check_seen: 90});
					return
            	}
            	if(!res.includes(':')) {
            		setter({check_seen: 60})
            		return;
            	}
            	let player_positions = {};
            	let rawpos = res.split("|");
            	for (let i = 0, len = rawpos.length; i < len; i++) {
            		let withid = rawpos[i].split(":");
            		let id = withid[0];
            		let pos = withid[1].split(",");
					player_positions[id] = [pos[1]*1.0, pos[0]*1.0];
				}
				setter((prevState, props) => {
					let retVal = prevState.players
					Object.keys(player_positions).map((id) => {
						if(!retVal.hasOwnProperty(id)) 
							retVal[id] = {...EMPTY_PLAYER};
						retVal[id].pos = player_positions[id]
					})
					return {players:retVal}
				})
            })(xmlHttp.responseText);
    }
    xmlHttp.open("GET", "/"+game_id+"/getPos", true); // true for asynchronous 
    xmlHttp.send(null);
}


export default GameTracker;