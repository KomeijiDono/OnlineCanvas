// 计算点到直线的距离
var getPointToLineDistance = (x0, y0, x1, y1, x2, y2) => {
    // 直线公式y=kx+b不适用于直线垂直于x轴的情况，所以对于直线垂直于x轴的情况单独处理
    if (x1 === x2) {
        return Math.abs(x0 - x1);// 计算数的绝对值
    }
    else {
        let k, b;
        k = (y2 - y1) / (x2 - x1);// 直线的斜率k
        b = y1 - k * x1;
        return Math.abs((k * x0 - y0 + b) / Math.sqrt(1 + k * k));// 点到直线的距离公式|kx0 - y0 + b| / sqrt(1 + k^2)
    }
};

// 检查是否点击到了一条边（线段）
var checkIsAtSegment = (x0, y0, x1, y1, x2, y2, strokeWeight) => {
    var dis = 15 - strokeWeight / 2;
    // 点到直线的距离不满足则返回，dis为选中距离
    if (getPointToLineDistance(x0, y0, x1, y1, x2, y2) > 15) {
        return false;
    }
    // 点到两个端点的距离
    let dis1 = getToExtremePointDistance(x0, y0, x1, y1);
    let dis2 = getToExtremePointDistance(x0, y0, x2, y2);
    // 线段长度
    let dis3 = getToExtremePointDistance(x1, y1, x2, y2);
    // 勾股定理计算斜边长度，即允许最远距离
    let max = Math.sqrt(dis * dis + dis3 * dis3);
    // 点距离两个端点的距离都要小于最远距离
    if (dis1 <= max && dis2 <= max) {
        return true;
    }
    return false;
};

// 计算两点之间的距离
var getToExtremePointDistance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}