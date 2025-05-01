import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalPanel, useGoalStore } from '../src/components/GoalPanel';
import '@testing-library/jest-dom';

// Mock goals data
const mockGoals = [
  {
    id: 'goal1',
    range: {
      start: { line: 10, character: 0 },
      end: { line: 10, character: 5 },
    },
    uri: 'file:///test.lean',
    goal: 'Test goal 1',
    tacticState: 'test ⊢ A → B',
  },
  {
    id: 'goal2',
    range: {
      start: { line: 15, character: 0 },
      end: { line: 15, character: 5 },
    },
    uri: 'file:///test.lean',
    goal: 'Test goal 2',
    tacticState: 'example ⊢ C → D',
  },
];

describe('GoalPanel', () => {
  beforeEach(() => {
    // Reset the store before each test
    useGoalStore.setState({
      goals: [],
      selectedGoalId: null,
    });
  });

  it('should render empty state when there are no goals', () => {
    const onGoalClick = vi.fn();
    render(<GoalPanel onGoalClick={onGoalClick} />);
    
    expect(screen.getByText('No active goals')).toBeInTheDocument();
  });

  it('should render goals correctly', () => {
    // Set goals in the store
    useGoalStore.setState({ goals: mockGoals });
    
    const onGoalClick = vi.fn();
    render(<GoalPanel onGoalClick={onGoalClick} />);
    
    // Check that goals are rendered
    expect(screen.getByText('Line 11')).toBeInTheDocument();
    expect(screen.getByText('Line 16')).toBeInTheDocument();
    expect(screen.getByText('test ⊢ A → B')).toBeInTheDocument();
    expect(screen.getByText('example ⊢ C → D')).toBeInTheDocument();
  });

  it('should call onGoalClick when a goal is clicked', () => {
    // Set goals in the store
    useGoalStore.setState({ goals: mockGoals });
    
    const onGoalClick = vi.fn();
    render(<GoalPanel onGoalClick={onGoalClick} />);
    
    // Click on the first goal
    fireEvent.click(screen.getByText('test ⊢ A → B'));
    
    // Check that onGoalClick was called with the correct goal
    expect(onGoalClick).toHaveBeenCalledWith(mockGoals[0]);
    
    // Check that the goal is selected in the store
    expect(useGoalStore.getState().selectedGoalId).toBe('goal1');
  });

  it('should mark the selected goal', () => {
    // Set goals in the store and select one
    useGoalStore.setState({
      goals: mockGoals,
      selectedGoalId: 'goal2',
    });
    
    const onGoalClick = vi.fn();
    render(<GoalPanel onGoalClick={onGoalClick} />);
    
    // Find the goals by their content
    const goal1 = screen.getByText('test ⊢ A → B').closest('.lean-goal');
    const goal2 = screen.getByText('example ⊢ C → D').closest('.lean-goal');
    
    // Check that goal2 has the selected class
    expect(goal1).not.toHaveClass('lean-goal-selected');
    expect(goal2).toHaveClass('lean-goal-selected');
  });
});