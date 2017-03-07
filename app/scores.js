var c1 = '-Ke5VqjCfDrMlPHuUixl';
var cd = new Date('2/6/2017').getTime();
var cu = 'RN3RCWtVE6SL5WE9NDPTfLVhQEH2';

var Database = InitDatabase();
var USER = false;
var KNOWN_USERS = {};
var SIMULATION_TIME = false;
var LEAGUE_ID = false;
var NEED_FIRST_RENDER = true;

Database.Auth.getCurrentUser().then((user) => {
	login(user);
}).catch((err) => {
	if(err === 'No user currently authenticated.'){
		var params = getQueryParams(document.location.search);
		if(params.userid){
			login({
				userid: params.userid
			});
		}
		else{
			displayMessage('Log in in to play Fantasy Civics!');
		}
	}
	else{
		console.error(err);
	}
});

var loginBtn = document.getElementById('login-button')
loginBtn.addEventListener('click', (e) => {
	Database.Auth.signInUser().then((user) => {
		login(user);
	}).catch(displayError);
});

function login(user){
	USER = user;
	KNOWN_USERS[USER.userid] = USER;
	Database.updateUser(user).then((done) => {
		main();
	}).catch(displayError);
}

function getQueryParams(qs) {
	qs = qs.split('+').join(' ');
	var params = {},
		tokens,
		re = /[?&]?([^=]+)=([^&]*)/g;
	while (tokens = re.exec(qs)) {
		params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
	}
	return params;
}

function displayMessage(message){
	var box = document.getElementById('message-container');
	var output = document.getElementById('message');
	var close = document.getElementById('close-message');
	box.style.display = 'block';
	output.innerText = message;
	close.addEventListener('click', (e) => {
		box.style.display = 'none';
	});
}

function displayError(err){
	console.error(err);
	displayMessage('Error: ' + err.toString());
}

function main(){

	console.log('Logged in as: ', USER);

	var page = document.getElementById('page');
		page.style.display = 'block';
	var login = document.getElementById('login');
		login.style.display = 'none';

	var params = getQueryParams(document.location.search);
	SIMULATION_TIME = parseInt(params.time, 10);
	LEAGUE_ID = params.league;

	if(LEAGUE_ID){
		render(SIMULATION_TIME);
	}
	else{
		displayError('Missing {league}.');
	}

}

function render(simulationTime){

	Database.getMatchScore({
		userid: USER.userid,
		leagueid: LEAGUE_ID,
		on: simulationTime
	}).then((score) => {

		var match = score.match;
			match.winner = score.winner;

		var homeUser = {
			userid: match.home,
			leagueid: LEAGUE_ID,
			players: score.rosters[match.home],
			from: match.start,
			to: match.end
		}
		var awayUser = {
			userid: match.away,
			leagueid: LEAGUE_ID,
			players: score.rosters[match.away],
			from: match.start,
			to: match.end
		}

		Database.getLeague({
			leagueid: LEAGUE_ID,
			from: match.start,
			to: match.end
		}).then((league) => {

			console.log(match)
			console.log(league)

			var selectOptions = renderWeekSelector(league.schedule)
			var select = document.getElementById('week-select');
				select.innerHTML = selectOptions;

			select.addEventListener('change', (e) => {
				var ts = parseInt(e.target.value, 10);
				render(ts);
			})

			var boxScoreDiv = renderBoxScore(match, homeUser, awayUser, league);
			var parent = document.getElementById('box-score');
			console.log('boxscore', parent.childNodes)
			if(parent.childNodes.length < 2){
				parent.appendChild(boxScoreDiv);	
			}
			else{
				parent.replaceChild(boxScoreDiv, parent.childNodes[2]);
			}
			var load = document.getElementById('loading-box-score');
			load.style.display = 'none';

			if(NEED_FIRST_RENDER){
				Database.getLeaderboard({
					leagueid: LEAGUE_ID
				}, league).then((leaderboard) => {
					var boardDiv = renderLeaderboard(leaderboard.rankings, leaderboard.records, league);
					var parent2 = document.getElementById('leaderboard');
					// Beware of Magic Numbers!!
					console.log('leader', parent2.childNodes)
					if(parent2.childNodes.length < 2){
						parent2.appendChild(boardDiv);	
					}
					else{
						parent2.replaceChild(boardDiv, parent2.childNodes[2]);
					}
					var load2 = document.getElementById('loading-leaderboard');
					load2.style.display = 'none';
					NEED_FIRST_RENDER = false;
				}).catch(displayError);
			}

		}).catch(displayError);

	}).catch(displayError);

}

function renderWeekSelector(schedule){
	var options = [];
	for(var w = 0; w < schedule.length; w++){
		for(var g = 0; g < schedule[w].length; g++){
			var match = schedule[w][g];
			if(match.winner){
				options.push({
					time: (0.5 * (match.end - match.start)) + match.start,
					label: 'Week ' + (w+1)
				});
				console.log('Week ' + (w+1) + ' has a winner')
				break;
			}
		}
	}
	console.log(options)
	var html = '';
	for(var i = 0; i < options.length; i++){
		var opt = options[i];
		html += '<option value="' + opt.time + '">' + opt.label + '</option>'
	}
	return html;
}

function createDOMTable(headers, rows){
	function listToRow(list){
		return '<tr>' + list.map((val) => { return '<td>' + val + '</td>'}).join('') + '</tr>';
	}
	var table = document.createElement('table');
	var html = '';
	if(headers){
		html += listToRow(headers);
	}
	for(var r = 0; r < rows.length; r++){
		html += listToRow(rows[r]);
	}
	table.innerHTML = html;
	return table;
}

var rosterSort = (a, b) => {
	var as = a.starter ? 1 : 0;
	var bs = b.starter ? 1 : 0;
	return bs - as;
}

var scoreFromMap = (map) => {
	var score = 0;
	Object.keys(map).map((key) => { score += map[key]; return 0; })
	return score;
}

function renderBoxScore(match, home, away, league){
	var SPACER = '<span class="spacer"></span>';
	var div = document.createElement('div');
	var h2 = document.createElement('h2');
		h2.innerText = 'Week ' + match.week + ' Matchup';
	var rows = [];
	var homeRoster = Object.keys(home.players).map((pid) => { return home.players[pid]; }).sort(rosterSort);
	var awayRoster = Object.keys(away.players).map((pid) => { return away.players[pid]; }).sort(rosterSort);
	var scores = {
		home: {
			lineup: 0,
			bench: 0
		},
		away: {
			lineup: 0,
			bench: 0
		}
	}
	var startingLineup = true;
			rows.push([league.users[match.home].name, '', '', league.users[match.away].name, '']);
			rows.push([league.users[match.home].team, '', '', league.users[match.away].team, '']);
			rows.push(['Player', 'Score', SPACER, 'Score', 'Player']);
			rows.push(['Starting Lineup', '', '', 'Starting Lineup', '']);
	for(var j = 0; j < homeRoster.length; j++){
		var homePlayer = homeRoster[j];
		var awayPlayer = awayRoster[j];
		if(!homePlayer.starter && startingLineup){
			startingLineup = false;
			rows.push([
				'',
				scores.home.lineup,
				'',
				'',
				scores.away.lineup
			]);
			rows.push([
				'Bench',
				'',
				'',
				'Bench',
				''
			]);
		}
		rows.push([
			homePlayer.name,
			scoreFromMap(homePlayer.scores),
			SPACER,
			awayPlayer.name,
			scoreFromMap(awayPlayer.scores)
		]);
		if(startingLineup){
			scores.home.lineup += scoreFromMap(homePlayer.scores);
			scores.away.lineup += scoreFromMap(awayPlayer.scores);
		}
		else{
			scores.home.bench += scoreFromMap(homePlayer.scores);
			scores.away.bench += scoreFromMap(awayPlayer.scores);
		}
	}
			rows.push([
				'',
				scores.home.bench,
				'',
				'',
				scores.away.bench
			]);
	var playerTable = createDOMTable(false, rows);
	div.appendChild(h2);
	var p = document.createElement('p');
	var winTeam = (match.winner === match.home) ? 'home' : 'away';
	var loseTeam = (match.winner === match.home) ? 'away' : 'home';
	p.innerText = league.users[match.winner].name + ' wins ' + scores[winTeam].lineup + ' - ' + scores[loseTeam].lineup + '.'
	div.appendChild(p);
	div.appendChild(playerTable);
	return div;
}

function renderLeaderboard(rankings, records, league){
	var div = document.createElement('div');
	var h2 = document.createElement('h2');
		h2.innerText = league.name + ' Leaderboard';
	var headers = [
		'Rank',
		'Name',
		'Record'
	];
	var rows = rankings.map((user, i) => {
		return [
			(i + 1),
			user.name,
			'(' + user.wins.length + '-' + user.losses.length + ')'
		];
	})
	var playerTable = createDOMTable(headers, rows);
	div.appendChild(h2);
	div.appendChild(playerTable);
	return div;	
}
