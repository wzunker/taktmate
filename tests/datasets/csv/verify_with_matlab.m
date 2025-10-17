clear all
close all
clc

% Load the employee payroll CSV file
data = readtable('employee_payroll.csv');

% Extract the Salary column (adjust column name if needed)
salaries = data.salary;

% Calculate statistics
mean_salary   = mean(salaries);
median_salary = median(salaries);
sum_salary    = sum(salaries);
max_salary    = max(salaries);
min_salary    = min(salaries);

% Display results
fprintf('Salary Statistics:\n');
fprintf('Mean:   %.2f\n', mean_salary);
fprintf('Median: %.2f\n', median_salary);
fprintf('Sum:    %.2f\n', sum_salary);
fprintf('Max:    %.2f\n', max_salary);
fprintf('Min:    %.2f\n\n', min_salary);

data_long = readtable('long_list_of_numbers.csv');
flow = data_long.Var1;

mean_flow   = mean(flow);
median_flow = median(flow);
sum_flow    = sum(flow);
max_flow    = max(flow);
min_flow    = min(flow);

fprintf('Flow Statistics:\n');
fprintf('Mean:   %.2f\n', mean_flow);
fprintf('Median: %.2f\n', median_flow );
fprintf('Sum:    %.2f\n', sum_flow);
fprintf('Max:    %.2f\n', max_flow);
fprintf('Min:    %.2f\n', min_flow);
