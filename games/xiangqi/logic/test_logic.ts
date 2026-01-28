
import { XiangqiLogic } from './index';

async function testAttackCount() {
    const logic = new XiangqiLogic();
    const state = logic.initState({ players: ['red', 'black'] }) as any;

    // Test 1: Initial state, red cannon attacking a position?
    // Red cannon at (7, 1) and (7, 7).
    // Cannon at (7,1) attacks (2,1) (capture cannon) if there is a screen?
    // No, initial board, cannon attacks can eat opponent cannon? 
    // Cannon needs a screen/mount (dian).
    // Top row 0: black pieces. Row 2: black cannons. Row 3: clear. Row 4: clear.
    // Row 5: clear. Row 6: red pawns. Row 7: red cannons. Row 9: red pieces.

    // Let's create a custom scenario.
    // Empty board.
    const emptyState = logic.cloneState(state);
    emptyState.board = Array(10).fill(null).map(() => Array(9).fill(null));

    // Place a Red Chariot at (5, 4)
    emptyState.board[5][4] = { type: 'chariot', color: 'red', char: '車' };

    // Check attack on (5, 5) -> Should be 1
    let count = logic.getAttackCountAtPosition(emptyState, 5, 5, 'red');
    console.log(`Test 1 (Chariot Attack): Expected 1, Got ${count}`);
    if (count !== 1) console.error('FAILED Test 1');

    // Place a Black Horse at (2, 2)
    emptyState.board[2][2] = { type: 'horse', color: 'black', char: '馬' };

    // Horse at (2, 2) attacks (4, 3) and (4, 1) etc.
    count = logic.getAttackCountAtPosition(emptyState, 4, 3, 'black');
    console.log(`Test 2 (Horse Attack): Expected 1, Got ${count}`);
    if (count !== 1) console.error('FAILED Test 2');

    // Block the horse at (3, 2)
    emptyState.board[3][2] = { type: 'soldier', color: 'black', char: '卒' };
    count = logic.getAttackCountAtPosition(emptyState, 4, 3, 'black'); // Should be blocked
    console.log(`Test 3 (Blocked Horse): Expected 0, Got ${count}`);
    if (count !== 0) console.error('FAILED Test 3');

    // Cannon test
    // Red Cannon at (5, 0). Screen at (5, 2). Target at (5, 4) (which is the Chariot).
    emptyState.board[5][0] = { type: 'cannon', color: 'red', char: '炮' };
    emptyState.board[5][2] = { type: 'soldier', color: 'red', char: '兵' }; // Screen

    // Check attack on (5, 4) (occupied by Chariot)
    // Cannon at (5,0) with screen (5,2) attacks (5,4)? 
    // Yes, standard cannon attack.
    count = logic.getAttackCountAtPosition(emptyState, 5, 4, 'red');
    console.log(`Test 4 (Cannon Attack Occupied): Expected 1, Got ${count}`); // Chariot (5,4) is NOT counted as attacker, it is the target position.
    // Wait, I am asking if "red" attacks (5,4).
    // Attackers: Chariot at (5,4)? No, a unit cannot attack itself or its own pos in this context usually, but getPieceRawMoves returns moves.
    // getPieceRawMoves for Chariot at (5,4) includes (5,5), (5,3) etc.
    // But does it include (5,4)? No.
    // So Chariot does not attack (5,4).
    // Cannon at (5,0) -> attacks (5,4) because screen at (5,2).
    // So count should be 1 (Cannon).
    if (count !== 1) console.error(`FAILED Test 4. Got ${count}`);

    // Check attack on (5, 5) (Empty)
    // Chariot at (5,4) attacks (5,5).
    // Cannon at (5,0) with screen (5,2) -> (5,4) is occupied.
    // So Cannon fire jumps over (5,2). Next piece is (5,4).
    // Can cannon attack (5,5)?
    // Cannon moves: (5,0) -> (5,1) (move), (5,3) (move).
    // (5,4) is occupied. Cannon cannot move to (5,4) unless it captures. It can capture (5,4).
    // Can it attack (5,5)? No, blocked by (5,4).
    // So only Chariot attacks (5,5).
    count = logic.getAttackCountAtPosition(emptyState, 5, 5, 'red');
    console.log(`Test 5 (Multiple Attackers check): Expected 1 (Chariot), Got ${count}`);
    if (count !== 1) console.error(`FAILED Test 5. Got ${count}`);

    console.log('Tests completed.');
}

testAttackCount().catch(console.error);
