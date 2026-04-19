const res = await fetch("http://localhost:5053/api/Game/hint", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
        CurrentState: Array(54).fill().map((_,i) => i===0 ? 5 : 0),
        LockedState: Array(54).fill(false)
    })
});
const text = await res.text();
console.log(text);
