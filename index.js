function* add(num) {
    let res = num;
    yield num + 1;
    res += 1;
    yield res + 2;
    res += 2;
    yield res + 3;
}

let func = add(1);
let result = {
    value: 1,
    done: false,
};

while (true) {
    result = func.next();
    if (result.done) {
        break;
    }
    console.log(result);
}


